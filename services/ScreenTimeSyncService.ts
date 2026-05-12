import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { NativeModules } from 'react-native';
import { auth, db } from '../firebase/firebaseConfig';
import NativeScreenTrackingService, { UploadTickPayload } from './NativeScreenTrackingService';

const { ScreenTimeTracker } = NativeModules;

/**
 * Syncs native screen-time (seconds per day) to Firestore + AsyncStorage.
 *
 * - Listens to NativeScreenTrackingService.onUploadTick (every ~5 minutes)
 * - For each tick, writes today's totalSeconds to:
 *   - `screen_time/<uid>` document (weekly structure with 4 weeks)
 * - Also stores a per-day value in AsyncStorage for DailySummaryService
 */
class ScreenTimeSyncService {
  private static instance: ScreenTimeSyncService;

  private unsubscribeNative: (() => void) | null = null;
  private initialized = false;
  /** Cache last synced value per date (YYYY-MM-DD) to avoid duplicate writes */
  private lastSyncedSecondsByDate: Record<string, number> = {};
  /** Last synced formatted time to avoid unnecessary updates */
  private lastSyncedFormattedTime: string = '';
  /** Timestamp when service was initialized (to prevent uploading stale 0 values) */
  private initTimestamp: number = 0;

  static getInstance(): ScreenTimeSyncService {
    if (!ScreenTimeSyncService.instance) {
      ScreenTimeSyncService.instance = new ScreenTimeSyncService();
    }
    return ScreenTimeSyncService.instance;
  }

  async initialize(): Promise<void> {
    try {
      if (this.initialized) {
        console.log('[ScreenTimeSyncService] Already initialized, skipping...');
        return;
      }
      this.initialized = true;
      this.initTimestamp = Date.now(); // Record initialization time

      console.log('[ScreenTimeSyncService] Initializing - fetching today\'s data from Firestore...');
      
      // Check and perform week rotation if needed (12 AM transition from Sunday to Monday)
      try {
        await this.checkAndRotateWeeks();
      } catch (rotateError) {
        console.error('[ScreenTimeSyncService] Week rotation failed (non-critical):', rotateError);
      }
      
      // Fetch today's data from Firestore on initialization
      try {
        await this.fetchTodayData();
      } catch (fetchError) {
        console.error('[ScreenTimeSyncService] Fetch today data failed (non-critical):', fetchError);
      }
      
      // Give extra time for native module to be updated
      await new Promise(resolve => setTimeout(resolve, 100));

      // Subscribe to native upload ticks (1-min interval + initial fire)
      try {
        this.unsubscribeNative = NativeScreenTrackingService.onUploadTick((payload) => {
          this.handleUploadTick(payload).catch((error) => {
            console.warn('ScreenTimeSyncService upload tick error', error);
          });
        });
      } catch (tickError) {
        console.error('[ScreenTimeSyncService] Upload tick subscription failed:', tickError);
      }

      console.log('✅ ScreenTimeSyncService initialized (listening for native screen-time ticks)');
    } catch (error) {
      console.error('[ScreenTimeSyncService] ❌ Critical initialization error:', error);
      this.initialized = false;
      // Don't throw - allow app to continue without sync service
    }
  }

  /**
   * Check if week rotation is needed and perform it automatically
   * This runs on app initialization to handle 12 AM transitions
   */
  private async checkAndRotateWeeks(): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      return;
    }

    try {
      const today = new Date();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayNames[today.getDay()];
      
      // Calculate current week start date (Monday)
      const dayNum = today.getDay(); // 0 = Sunday, 1 = Monday, ...
      const diff = dayNum === 0 ? -6 : 1 - dayNum;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + diff);
      const weekStartDate = weekStart.toISOString().slice(0, 10);

      const { setDoc } = await import('firebase/firestore');
      const screenTimeRef = doc(db, 'screen_time', user.uid);
      const currentDoc = await getDoc(screenTimeRef);
      
      if (!currentDoc.exists()) {
        return;
      }

      const currentData = currentDoc.data();
      
      // Check if week rotation is needed (weekStartDate changed)
      if (currentData.week4?.weekStartDate && currentData.week4.weekStartDate !== weekStartDate) {
        console.log(`[ScreenTimeSyncService] 🔄 Auto-rotation triggered - New week detected!`);
        console.log(`[ScreenTimeSyncService] Old week: ${currentData.week4.weekStartDate}, New week: ${weekStartDate}`);
        
        // Calculate week 4 average before rotating
        const week4Data = currentData.week4 || {};
        let week4Total = 0;
        let week4Days = 0;
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
          if (week4Data[day]?.seconds > 0) {
            week4Total += week4Data[day].seconds;
            week4Days++;
          }
        });
        const week4Average = week4Days > 0 ? Math.round(week4Total / week4Days) : 0;
        
        // Rotate weeks: week3 → week2, week2 → week1, week4 average → week3
        const rotatedData: any = {
          week3: {
            averageSeconds: week4Average,
            averageDuration: this.formatDuration(week4Average),
            weekStartDate: week4Data.weekStartDate || '',
            calculatedOn: new Date().toISOString(),
          },
          week2: currentData.week3 || {
            averageSeconds: 0,
            averageDuration: '0h 0m 0s',
            weekStartDate: '',
          },
          week1: currentData.week2 || {
            averageSeconds: 0,
            averageDuration: '0h 0m 0s',
            weekStartDate: '',
          },
          // Reset week4 completely with zeros
          week4: {
            monday: { seconds: 0, date: '', duration: '0h 0m 0s' },
            tuesday: { seconds: 0, date: '', duration: '0h 0m 0s' },
            wednesday: { seconds: 0, date: '', duration: '0h 0m 0s' },
            thursday: { seconds: 0, date: '', duration: '0h 0m 0s' },
            friday: { seconds: 0, date: '', duration: '0h 0m 0s' },
            saturday: { seconds: 0, date: '', duration: '0h 0m 0s' },
            sunday: { seconds: 0, date: '', duration: '0h 0m 0s' },
            weekStartDate: weekStartDate,
          },
        };
        
        await setDoc(screenTimeRef, rotatedData, { merge: true });
        console.log(`[ScreenTimeSyncService] ✅ Auto-rotation complete - Week 4 reset, avg stored in week 3: ${this.formatDuration(week4Average)}`);
      } else {
        console.log(`[ScreenTimeSyncService] ✓ No rotation needed - current week: ${weekStartDate}`);
      }
    } catch (error: any) {
      // Silently skip permission errors (auth not ready yet)
      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        return; // Auth token not ready, will retry later
      }
      console.error('[ScreenTimeSyncService] ❌ Auto-rotation failed:', error);
    }
  }

  /**
   * Fetch today's screen time data from Firestore and load into AsyncStorage
   * Public method to allow manual fetching on login
   */
  async fetchTodayData(): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      console.log('[ScreenTimeSyncService] No user logged in, skipping fetch');
      return;
    }

    try {
      // Get today's date key
      const today = new Date();
      const dateKey = today.toISOString().slice(0, 10); // YYYY-MM-DD
      const storageDateKey = `screenTime_${user.uid}_${today.toDateString()}`; // User-specific AsyncStorage key
      
      // Get day of week for weekly structure lookup
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayNames[today.getDay()];

      // Fetch from Firestore (screen_time collection with weekly structure)
      const userRef = doc(db, 'screen_time', user.uid);
      const userSnap = await getDoc(userRef);

      console.log(`[ScreenTimeSyncService] Firestore fetch - exists: ${userSnap.exists()}`);

      if (!userSnap.exists()) {
        console.log('[ScreenTimeSyncService] ⚠️ No screen_time document found for user');
        return;
      }

      const data = userSnap.data();
      
      // Firestore stores weekly data as flat fields like "week4.sunday", not nested objects
      const fieldName = `week4.${dayOfWeek}`;
      const todayData = data?.[fieldName];

      console.log(`[ScreenTimeSyncService] Looking for field: ${fieldName}`, todayData);

      if (todayData && todayData.seconds !== undefined) {
        const seconds = todayData.seconds;

        console.log(`[ScreenTimeSyncService] ✅ Found today's data: ${seconds}s (${todayData.duration || '0h 0m 0s'})`);

        // Store in AsyncStorage
        await AsyncStorage.setItem(storageDateKey, String(seconds));
        console.log(`[ScreenTimeSyncService] ✅ Saved to AsyncStorage: ${storageDateKey} = ${seconds}s`);

        // CRITICAL: Set in native module so tracking continues from this value
        try {
          await ScreenTimeTracker?.setTodayScreenTime?.(seconds);
          console.log(`[ScreenTimeSyncService] ✅ Fetched & set in native: ${seconds}s`);
        } catch (nativeErr) {
          console.error('[ScreenTimeSyncService] Failed to set native time:', nativeErr);
        }
      } else {
        console.log(`[ScreenTimeSyncService] ⚠️ No data found for ${dayOfWeek} in week4 - starting fresh`);
        // Set 0 as starting point
        await AsyncStorage.setItem(storageDateKey, '0');
        await ScreenTimeTracker?.setTodayScreenTime?.(0);
      }

      // Populate last 7 days into AsyncStorage for Report screen from weekly data
      try {
        const writes: Array<Promise<void>> = [];
        
        // Process week4 (current week) - all 7 days from flat fields
        dayNames.forEach((day) => {
          const fieldName = `week4.${day}`;
          const dayData = data?.[fieldName];
          if (dayData && dayData.seconds !== undefined && dayData.date) {
            const dayDate = new Date(dayData.date);
            const dayKey = `screenTime_${user.uid}_${dayDate.toDateString()}`;
            writes.push(AsyncStorage.setItem(dayKey, String(dayData.seconds)));
          }
        });

        await Promise.all(writes);
        console.log(`[ScreenTimeSyncService] ✅ Loaded last ${writes.length} day(s) from Firestore into AsyncStorage`);
      } catch (e) {
        console.warn('[ScreenTimeSyncService] Failed to populate last 7 days', e);
      }
    } catch (error) {
      console.error('[ScreenTimeSyncService] Error fetching today\'s data:', error);
    }
  }

  /**
   * Parse duration string (e.g., "1h 20m 30s") back to total seconds
   */
  private parseDuration(duration: string): number {
    let totalSeconds = 0;

    // Parse hours
    const hoursMatch = duration.match(/(\d+)h/);
    if (hoursMatch) totalSeconds += parseInt(hoursMatch[1]) * 3600;

    // Parse minutes
    const minsMatch = duration.match(/(\d+)m/);
    if (minsMatch) totalSeconds += parseInt(minsMatch[1]) * 60;

    // Parse seconds
    const secsMatch = duration.match(/(\d+)s/);
    if (secsMatch) totalSeconds += parseInt(secsMatch[1]);

    return totalSeconds;
  }

  private formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours}h ${mins}m ${secs}s`;
  }

  private async cleanupOldEntries(collectionName: string, userId: string): Promise<void> {
    try {
      const userRef = doc(db, collectionName, userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) return;

      const data = userSnap.data();
      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const sevenDaysAgoTime = sevenDaysAgo.getTime();

      const fieldsToDelete: Record<string, any> = {};

      Object.keys(data).forEach(key => {
        if (key.startsWith('screenTime_')) {
          const dateStr = key.replace('screenTime_', '');
          try {
            // Use numeric comparison for dates (safer than string comparison)
            const dateTime = new Date(dateStr).getTime();
            if (!isNaN(dateTime) && dateTime < sevenDaysAgoTime) {
              fieldsToDelete[key] = null; // Mark for deletion
            }
          } catch (e) {
            // Invalid date format - skip
            console.warn(`[ScreenTimeSyncService] Invalid date format in key: ${key}`);
          }
        }
      });

      if (Object.keys(fieldsToDelete).length > 0) {
        await updateDoc(userRef, fieldsToDelete);
        console.log(`[ScreenTimeSyncService] Cleaned up ${Object.keys(fieldsToDelete).length} old entries`);
      }
    } catch (e) {
      console.warn('[ScreenTimeSyncService] Cleanup error', e);
    }
  }

  private async handleUploadTick(payload: UploadTickPayload): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      // No logged-in user; nothing to sync
      return;
    }

    const { totalSeconds, date } = payload;

    // CRITICAL: Prevent uploading 0 or very low values during initial grace period
    // This prevents overwriting existing Firestore data when app just started
    const timeSinceInit = Date.now() - this.initTimestamp;
    const GRACE_PERIOD_MS = 30000; // 30 seconds
    
    if (timeSinceInit < GRACE_PERIOD_MS && totalSeconds < 10) {
      console.log(`[ScreenTimeSyncService] Skipping upload of ${totalSeconds}s during grace period (${Math.floor(timeSinceInit / 1000)}s since init)`);
      return;
    }

    // Validate totalSeconds
    if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
      console.warn(`[ScreenTimeSyncService] Invalid totalSeconds: ${totalSeconds}`);
      return;
    }

    // Format duration
    const formattedDuration = this.formatDuration(totalSeconds);

    // Skip if no change since last sync
    if (formattedDuration === this.lastSyncedFormattedTime) {
      return;
    }

    this.lastSyncedFormattedTime = formattedDuration;
    this.lastSyncedSecondsByDate[date] = totalSeconds;

    // Upload to screen_time collection
    const nowMs = Date.now();
    const nowISO = new Date().toISOString();

    try {
      // Write weekly structured data
      await this.writeWeeklyData(user.uid, date, totalSeconds, formattedDuration);

      console.log(`[ScreenTimeSyncService] Queued upload ${formattedDuration} for screen_time/${user.uid} (${date})`);

      // Store in AsyncStorage
      await this.storeInAsyncStorage(date, totalSeconds);
    } catch (e) {
      console.warn('[ScreenTimeSyncService] Queue/upload error', e);
    }
  }

  /**
   * Write weekly structured data to Firestore
   * Week 4 = Current week (full day-wise data)
   * Week 3, 2, 1 = Previous weeks (average only)
   */
  private async writeWeeklyData(
    userId: string,
    date: string,
    seconds: number,
    formattedDuration: string
  ): Promise<void> {
    try {
      const { setDoc } = await import('firebase/firestore');
      
      // Double-check auth state before Firestore operations
      const user = auth.currentUser;
      if (!user || user.uid !== userId) {
        console.warn('[ScreenTimeSyncService] Auth state mismatch, skipping write');
        return;
      }
      
      // Parse date to get day of week
      const dateObj = new Date(date);
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayNames[dateObj.getDay()]; // monday, tuesday, etc.
      
      // Get week start date (Monday of current week)
      const dayNum = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ...
      const diff = dayNum === 0 ? -6 : 1 - dayNum; // Calculate days to Monday
      const weekStart = new Date(dateObj);
      weekStart.setDate(dateObj.getDate() + diff);
      const weekStartDate = weekStart.toISOString().slice(0, 10);

      // Reference to screen_time/{userId} document
      const screenTimeRef = doc(db, 'screen_time', userId);
      
      // Get current document to check if we need to rotate weeks
      const currentDoc = await getDoc(screenTimeRef);
      const currentData = currentDoc.exists() ? currentDoc.data() : {};
      
      // Check if today is Sunday - calculate and store week average in week3
      if (dayOfWeek === 'sunday') {
        console.log(`[ScreenTimeSyncService] 📊 Sunday detected - calculating week 4 average...`);
        
        // Calculate average for entire week 4 (all 7 days)
        const week4Data = currentData.week4 || {};
        let week4Total = 0;
        let week4Days = 0;
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
          if (week4Data[day]?.seconds > 0) {
            week4Total += week4Data[day].seconds;
            week4Days++;
          }
        });
        const week4Average = week4Days > 0 ? Math.round(week4Total / week4Days) : 0;
        
        // Store week 4 average in week 3
        const week3Data = {
          week3: {
            averageSeconds: week4Average,
            averageDuration: this.formatDuration(week4Average),
            weekStartDate: week4Data.weekStartDate || weekStartDate,
            calculatedOn: new Date().toISOString(),
          },
        };
        
        await setDoc(screenTimeRef, week3Data, { merge: true });
        console.log(`[ScreenTimeSyncService] ✅ Week 4 average stored in week 3: ${this.formatDuration(week4Average)} (${week4Days} days)`);
      }
      
      // Check if we're starting a new week (Monday after Sunday - transition detected)
      if (currentData.week4?.weekStartDate && currentData.week4.weekStartDate !== weekStartDate) {
        console.log(`[ScreenTimeSyncService] 🔄 New week detected (Monday)! Rotating weeks and resetting week 4...`);
        
        // Rotate weeks: week3 → week2, week2 → week1
        const rotatedData: any = {
          week2: currentData.week3 || {
            averageSeconds: 0,
            averageDuration: '0h 0m 0s',
            weekStartDate: '',
          },
          week1: currentData.week2 || {
            averageSeconds: 0,
            averageDuration: '0h 0m 0s',
            weekStartDate: '',
          },
          // Reset week4 (current week) with empty days for new week
          week4: {
            monday: { seconds: 0, date: '', duration: '0h 0m 0s' },
            tuesday: { seconds: 0, date: '', duration: '0h 0m 0s' },
            wednesday: { seconds: 0, date: '', duration: '0h 0m 0s' },
            thursday: { seconds: 0, date: '', duration: '0h 0m 0s' },
            friday: { seconds: 0, date: '', duration: '0h 0m 0s' },
            saturday: { seconds: 0, date: '', duration: '0h 0m 0s' },
            sunday: { seconds: 0, date: '', duration: '0h 0m 0s' },
            weekStartDate: weekStartDate,
          },
        };
        
        await setDoc(screenTimeRef, rotatedData, { merge: true });
        console.log(`[ScreenTimeSyncService] ✅ Week 4 reset for new week starting ${weekStartDate}`);
      }
      
      // Update current day's data in week4
      const updateData = {
        userId: userId, // Store userId for reference
        [`week4.${dayOfWeek}`]: {
          seconds: seconds,
          date: date,
          duration: formattedDuration,
        },
        [`week4.weekStartDate`]: weekStartDate,
        lastUpdated: new Date(),
      };

      await setDoc(screenTimeRef, updateData, { merge: true });

      console.log(`[ScreenTimeSyncService] ✅ Updated week4.${dayOfWeek} with ${formattedDuration}`);
    } catch (error: any) {
      // Silently skip permission errors (auth not ready yet)
      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        return; // Auth token not ready, will retry on next tick
      }
      console.warn('[ScreenTimeSyncService] ⚠️ Weekly data write failed:', error);
    }
  }

  // Store in AsyncStorage for backward compatibility
  private async storeInAsyncStorage(date: string, seconds: number): Promise<void> {
    try {
      const jsDate = new Date(`${date}T00:00:00`);
      const dailyKey = `screenTime_${jsDate.toDateString()}`;
      await AsyncStorage.setItem(dailyKey, String(seconds));
    } catch (e) {
      console.warn('ScreenTimeSyncService AsyncStorage write error', e);
    }
  }

  cleanup(): void {
    if (this.unsubscribeNative) {
      this.unsubscribeNative();
      this.unsubscribeNative = null;
    }
    this.initialized = false;
    this.lastSyncedSecondsByDate = {};
  }

  /**
   * Force immediate sync of current screen time to Firestore
   * Called before logout to ensure all data is uploaded
   */
  async forceSync(): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      console.log('[ScreenTimeSyncService] No user logged in, skipping force sync');
      return;
    }

    try {
      console.log('🔄 Force syncing screen time before logout...');

      // Get current screen time from native module
      let totalSeconds = 0;
      if (ScreenTimeTracker) {
        try {
          totalSeconds = await ScreenTimeTracker.getTodayScreenTime();
        } catch (e) {
          console.warn('[ScreenTimeSyncService] Failed to get native time for force sync', e);
        }
      }

      // Also check AsyncStorage
      const today = new Date();
      const userId = auth.currentUser?.uid;
      if (userId) {
        const storageDateKey = `screenTime_${userId}_${today.toDateString()}`;
        try {
          const cached = await AsyncStorage.getItem(storageDateKey);
          if (cached) {
            const cachedSeconds = parseInt(cached, 10);
            if (!isNaN(cachedSeconds) && cachedSeconds > totalSeconds) {
              totalSeconds = cachedSeconds;
            }
          }
        } catch (e) {
          console.warn('[ScreenTimeSyncService] Failed to get cached time for force sync', e);
        }
      }

      if (totalSeconds <= 0) {
        console.log('[ScreenTimeSyncService] No screen time to sync');
        return;
      }

      const dateKey = today.toISOString().slice(0, 10); // YYYY-MM-DD

      // Manually trigger upload
      await this.handleUploadTick({
        totalSeconds,
        date: dateKey,
      });

      console.log(`✅ Force sync completed: ${totalSeconds}s uploaded to Firestore`);
    } catch (error) {
      console.error('❌ Force sync failed:', error);
      throw error; // Re-throw so logout knows sync failed
    }
  }

  /**
   * One-off sync helper used by BackgroundTasks.
   * Returns true on success, false on failure.
   */
  async syncNow(): Promise<boolean> {
    try {
      await this.forceSync();
      return true;
    } catch (error) {
      console.error('[ScreenTimeSyncService] syncNow failed', error);
      return false;
    }
  }

  /**
   * Static method to get/create singleton instance
   */
  static initialize(): Promise<void> {
    return ScreenTimeSyncService.getInstance().initialize();
  }

  /**
   * Static cleanup method
   */
  static cleanup(): void {
    return ScreenTimeSyncService.getInstance().cleanup();
  }

  /**
   * Static force sync method - sync immediately before logout
   */
  static forceSync(): Promise<void> {
    return ScreenTimeSyncService.getInstance().forceSync();
  }

  /**
   * Static sync now method - used by background tasks
   */
  static syncNow(): Promise<boolean> {
    return ScreenTimeSyncService.getInstance().syncNow();
  }
}

export default ScreenTimeSyncService;

