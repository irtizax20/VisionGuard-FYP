import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, NativeModules, Platform } from 'react-native';
import { auth } from '../firebase/firebaseConfig';
import NativeScreenTrackingService from '../services/NativeScreenTrackingService';
import ScreenTimeSyncService from '../services/ScreenTimeSyncService';
import NativeUsageStats from '../src/services/NativeUsageStats';
import { SafeAsyncStorage, safeParseInt } from '../utils/errorHandling';
import Logger from '../utils/logger';

const { ScreenTimeTracker } = NativeModules;
const FACE_KEY = 'faceVerificationCompleted';

// Types for daily/weekly usage hooks
export interface DailyUsageAppItem {
  packageName: string;
  totalTimeInForeground: number; // ms
  appName?: string;
}

export interface DailyUsage {
  totalScreenTime: number; // seconds
  usageByApp: DailyUsageAppItem[];
}

type MaybeError = string | null;

interface ScreenTimeContextValue {
  /** Total screen time in seconds (live updates) */
  screenTimeSeconds: number;
  /** Whether native tracking service is running */
  isTracking: boolean;
  /** Formatted time string (e.g., "1h 20m 30s") */
  formattedTime: string;
  /** Start native tracking */
  startTracking: () => Promise<void>;
  /** Stop native tracking */
  stopTracking: () => Promise<void>;
  /** Manually refresh screen time */
  refreshScreenTime: () => Promise<void>;
  /** Whether usage access permission is granted */
  hasPermission: boolean;
  /** Whether permission check is loading */
  isLoading: boolean;
  /** Request usage access permission */
  requestPermission: () => Promise<void>;
}

const ScreenTimeContext = createContext<ScreenTimeContextValue | undefined>(undefined);

const CACHE_KEY = 'global_screen_time_cache';
const UPDATE_INTERVAL = 1000; // Always update every 1 second for consistent display

export const ScreenTimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [screenTimeSeconds, setScreenTimeSeconds] = useState<number>(0);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const updateIntervalRef = useRef<number | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Format screen time for display
  const formattedTime = React.useMemo(() => {
    const safeSeconds = Math.max(0, Math.floor(screenTimeSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const mins = Math.floor((safeSeconds % 3600) / 60);
    const secs = safeSeconds % 60;
    return `${hours}h ${mins}m ${secs}s`;
  }, [screenTimeSeconds]);

  // Fetch screen time from native module
  const refreshScreenTime = useCallback(async () => {
    try {
      let status;
      try {
        status = await NativeScreenTrackingService.getStatus();
      } catch (statusError) {
        console.error('[ScreenTimeContext] Failed to get status:', statusError);
        return; // Exit early to prevent crash
      }
      
      if (!status) {
        console.error('[ScreenTimeContext] Status is null/undefined');
        return;
      }
      
      const seconds = status.totalSeconds;
      
      // Update tracking status from the same call
      setIsTracking(!!status.isTracking);
      
      if (typeof seconds === 'number' && !isNaN(seconds)) {
        // CRITICAL: Only update if new value is greater than or equal to current
        // This prevents race conditions where Firestore data hasn't synced to native yet
        // Use callback form to get the latest state value
        let shouldUpdate = false;
        setScreenTimeSeconds(prevSeconds => {
          // If native has more time, update (normal case - tracking is running)
          if (seconds >= prevSeconds) {
            shouldUpdate = true;
            return seconds;
          }
          
          // If native < cached, this means either:
          // 1. App restarted and native reset
          // 2. Data sync in progress
          const gap = prevSeconds - seconds;
          
          // For any backward movement, use native value (trust the native module)
          console.log(`[ScreenTimeContext] ⚠️ Native < cached (gap: ${gap}s) - using native: ${seconds}s`);
          shouldUpdate = true;
          return seconds;
        });

        // Only cache if we actually updated the value (don't cache stale/lower values)
        if (shouldUpdate) {
          const cached = await SafeAsyncStorage.setItem(CACHE_KEY, String(seconds));
          if (!cached) {
            Logger.warn('Failed to cache screen time', 'ScreenTimeContext');
          }

          // Also persist to per-day key so Report screen shows data immediately
          try {
            const today = new Date();
            const dailyKey = `screenTime_${today.toDateString()}`;
            await SafeAsyncStorage.setItem(dailyKey, String(seconds));
          } catch (e) {
            Logger.warn('Failed to persist daily screen time', 'ScreenTimeContext');
          }
        }
      }
    } catch (error) {
      Logger.error('Failed to fetch screen time', 'ScreenTimeContext', error);
    }
  }, []);

  // Start native tracking
  const startTracking = useCallback(async () => {
    try {
      const ok = await NativeScreenTrackingService.startTracking();
      setIsTracking(!!ok);
      console.log('[ScreenTimeContext] Native tracking started');
    } catch (error) {
      console.error('[ScreenTimeContext] Failed to start tracking:', error);
    }
  }, []);

  // Stop native tracking
  const stopTracking = useCallback(async () => {
    try {
      // Prefer native stop if available, else JS fallback simply marks not tracking
      if ((NativeModules as any)?.ScreenTimeTracker?.stopTracking) {
        await (NativeModules as any).ScreenTimeTracker.stopTracking();
      }
      setIsTracking(false);
      console.log('[ScreenTimeContext] Native tracking stopped');
    } catch (error) {
      console.error('[ScreenTimeContext] Failed to stop tracking:', error);
    }
  }, []);

  // Check tracking status
  const checkTrackingStatus = useCallback(async () => {
    try {
      const status = await NativeScreenTrackingService.getStatus();
      setIsTracking(!!status.isTracking);
    } catch (error) {
      console.error('[ScreenTimeContext] Failed to check tracking status:', error);
    }
  }, []);

  // Check usage access permission
  const checkPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setHasPermission(false);
      return;
    }
    try {
      setIsLoading(true);
      let status;
      try {
        status = await NativeScreenTrackingService.getStatus();
      } catch (statusError) {
        console.error('[ScreenTimeContext] Permission check failed:', statusError);
        setHasPermission(false);
        return;
      }
      setHasPermission(!!status?.hasUsageAccess);
    } catch {
      setHasPermission(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Request usage access permission
  const requestPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      setIsLoading(true);
      await NativeScreenTrackingService.openUsageAccessSettings();
      // Give user a moment to toggle, then re-check
      setTimeout(checkPermission, 1500) as unknown as NodeJS.Timeout;
    } finally {
      setIsLoading(false);
    }
  }, [checkPermission]);


  // Single-place initializer for ScreenTime tracking only; guarded so it runs only once per login
  const initializedRef = useRef(false);
  const initializeScreenTimeIfReady = useCallback(async () => {
    try {
      if (initializedRef.current) return;
      const user = auth.currentUser;
      if (!user) return;

      let faceVerified;
      try {
        faceVerified = await SafeAsyncStorage.getItem(FACE_KEY);
      } catch (storageError) {
        console.error('[ScreenTimeContext] Failed to check face verification:', storageError);
        return;
      }
      
      if (faceVerified !== 'true') {
        // Not verified yet; will try again on next trigger
        return;
      }

      console.log('[ScreenTimeContext] Face verified - initializing screen time tracking');
      
      // ScreenTimeSyncService should already be initialized by auth state handler
      // Wait for data from Firestore to be loaded into AsyncStorage & native
      console.log('[ScreenTimeContext] Waiting for Firestore data to sync...');
      await new Promise(resolve => setTimeout(resolve, 400));

      console.log('[ScreenTimeContext] Checking native tracking status...');
      
      let statusCheck;
      try {
        statusCheck = await NativeScreenTrackingService.getStatus();
      } catch (statusError) {
        console.error('[ScreenTimeContext] Failed to get native status:', statusError);
        setIsTracking(false);
        return; // Exit without crashing
      }
      
      if (!statusCheck) {
        console.error('[ScreenTimeContext] Status check returned null');
        setIsTracking(false);
        return;
      }
      
      console.log(`[ScreenTimeContext] Initial status - isTracking: ${statusCheck.isTracking}, hasPermission: ${statusCheck.hasUsageAccess}, totalSeconds: ${statusCheck.totalSeconds}`);
      
      // Don't start tracking here if permission not granted - Main dashboard will handle it
      if (!statusCheck.hasUsageAccess) {
        console.log('[ScreenTimeContext] ⚠️ Permission not granted - waiting for Main dashboard to handle');
        setIsTracking(false);
        // Don't mark as initialized, allow retry after permission is granted
        return;
      }

      // Load data from AsyncStorage (Firestore data written by ScreenTimeSyncService)
      const today = new Date();
      const storageDateKey = `screenTime_${currentUserId}_${today.toDateString()}`;
      
      let storedSeconds;
      try {
        storedSeconds = await SafeAsyncStorage.getItem(storageDateKey);
      } catch (storageError) {
        console.error('[ScreenTimeContext] Failed to read from AsyncStorage:', storageError);
        storedSeconds = null;
      }
      
      console.log(`[ScreenTimeContext] Checking AsyncStorage for ${storageDateKey}: ${storedSeconds}`);
      
      if (storedSeconds !== null) {
        const parsed = safeParseInt(storedSeconds, 0);
        // Process data from Firestore
        if (!isNaN(parsed) && parsed >= 0) {
          // Get current native value
          let currentNativeSeconds = 0;
          try {
            currentNativeSeconds = await ScreenTimeTracker?.getTodayScreenTime?.() || 0;
          } catch (nativeError) {
            console.error('[ScreenTimeContext] Failed to get native screen time:', nativeError);
          }
          
          console.log(`[ScreenTimeContext] Native: ${currentNativeSeconds}s, Firestore (storage): ${parsed}s`);

          // Use the maximum value (prefer Firestore if it's greater, otherwise use native)
          const maxSeconds = Math.max(currentNativeSeconds, parsed);
          
          // If Firestore value is greater, update native module
          if (parsed > currentNativeSeconds) {
            try {
              await ScreenTimeTracker?.setTodayScreenTime?.(parsed);
              console.log(`[ScreenTimeContext] ✅ Updated native from Firestore data: ${parsed}s`);
            } catch (err) {
              console.error('[ScreenTimeContext] ❌ Failed to update native:', err);
            }
          }

          // Display the max value
          setScreenTimeSeconds(maxSeconds);
          console.log(`[ScreenTimeContext] ✅ Loaded screen time: ${maxSeconds}s`);
        }
      } else {
        console.log('[ScreenTimeContext] ⚠️ No stored data found - starting fresh or continuing from native');
        // Use whatever is in native (could be 0 or existing value)
        setScreenTimeSeconds(statusCheck.totalSeconds);
      }
      
      // Now start/verify tracking
      let running = statusCheck.isTracking;
      if (!running) {
        console.log('[ScreenTimeContext] Permission granted but tracking not running, starting...');
        
        try {
          await startTracking();
        } catch (startError) {
          console.error('[ScreenTimeContext] Failed to start tracking:', startError);
        }
        
        // Re-check after attempting start
        try {
          statusCheck = await NativeScreenTrackingService.getStatus();
          if (statusCheck) {
            running = statusCheck.isTracking;
            console.log(`[ScreenTimeContext] After start attempt - isTracking: ${running}, totalSeconds: ${statusCheck.totalSeconds}`);
          }
        } catch (recheckError) {
          console.error('[ScreenTimeContext] Failed to recheck status:', recheckError);
        }
        
        // Don't update UI here - data is already loaded from Firestore
        // Native module will continue from the value set by ScreenTimeSyncService
      } else {
        console.log('[ScreenTimeContext] ✅ Native tracking already running - keeping existing data');
      }
      setIsTracking(!!running);

      // Mark initialized only if service is running to allow future retries otherwise
      if (running) {
        initializedRef.current = true;
        console.log('[ScreenTimeContext] ✅ Initialization complete - marked as initialized');
      }

      // Always check and update tracking status at the end to ensure UI is correct
      try {
        await checkTrackingStatus();
      } catch (checkError) {
        console.error('[ScreenTimeContext] Failed to check tracking status:', checkError);
      }
    } catch (e) {
      console.error('[ScreenTimeContext] ❌ Screen time initialization error:', e);
      // Don't throw - allow app to continue
    }
  }, [refreshScreenTime, startTracking, checkTrackingStatus]);

  // Clear local screen time data (called on logout/user switch ONLY)
  const clearLocalData = useCallback(async () => {
    try {
      console.log('[ScreenTimeContext] Clearing local screen time data for logout/switch');

      // Clear global cache
      await SafeAsyncStorage.removeItem(CACHE_KEY);
      
      // Clear ALL screenTime_* keys (not just today's)
      const allKeys = await AsyncStorage.getAllKeys();
      const screenTimeKeys = allKeys.filter(key => key.startsWith('screenTime_'));
      if (screenTimeKeys.length > 0) {
        await AsyncStorage.multiRemove(screenTimeKeys);
        console.log(`[ScreenTimeContext] 🗑️ Removed ${screenTimeKeys.length} screenTime entries`);
      }

      // DON'T clear native module here - let it continue tracking
      // Native module will be updated with Firestore data on next login
      // Only clear if user actually logged out (not just switching)
      // await NativeScreenTrackingService.clearTodayScreenTime();

      // Reset state to 0 for UI
      setScreenTimeSeconds(0);
      
      console.log('[ScreenTimeContext] ✅ Local caches cleared (native module preserved)');
    } catch (e) {
      console.warn('[ScreenTimeContext] Failed to clear local data', e);
    }
  }, []);

  // Load cached screen time AND native screen time on mount (only if logged in)
  useEffect(() => {
    const loadInitialTime = async () => {
      try {
        // Only load if user is logged in
        if (!auth.currentUser) {
          console.log('[ScreenTimeContext] No user logged in - skipping initial load');
          return;
        }

        // CRITICAL: Check if face verification is done before initializing
        try {
          const faceVerified = await SafeAsyncStorage.getItem(FACE_KEY);
          if (faceVerified !== 'true') {
            console.log('[ScreenTimeContext] Face verification pending - skipping initial load to prevent crash');
            return;
          }
        } catch (faceCheckError) {
          console.error('[ScreenTimeContext] Failed to check face verification:', faceCheckError);
          return; // Exit safely
        }

        console.log('[ScreenTimeContext] Loading initial screen time data...');
        
        // Check permission first
        try {
          await checkPermission();
        } catch (permError) {
          console.error('[ScreenTimeContext] Permission check failed:', permError);
        }

        // Check tracking status immediately to show correct status
        try {
          const status = await NativeScreenTrackingService.getStatus();
          if (status) {
            setIsTracking(!!status.isTracking);
            console.log(`[ScreenTimeContext] Initial tracking status: ${status.isTracking}`);
          }
        } catch (statusError) {
          console.warn('[ScreenTimeContext] Failed to check initial tracking status:', statusError);
        }

        // Try to get from native module first (most up-to-date)
        let nativeSeconds = 0;
        if (ScreenTimeTracker) {
          try {
            nativeSeconds = await ScreenTimeTracker.getTodayScreenTime();
          } catch (nativeError) {
            console.warn('[ScreenTimeContext] Failed to get native time:', nativeError);
          }
        }

        // Also check cache
        let cachedSeconds = 0;
        try {
          const cached = await SafeAsyncStorage.getItem(CACHE_KEY);
          if (cached != null) {
            cachedSeconds = safeParseInt(cached, 0);
          }
        } catch (cacheError) {
          console.warn('[ScreenTimeContext] Failed to get cached time:', cacheError);
        }

        // Also check per-day key (which ScreenTimeSyncService writes from Firestore)
        let dailySeconds = 0;
        try {
          const today = new Date();
          const daily = await SafeAsyncStorage.getItem(`screenTime_${today.toDateString()}`);
          if (daily != null) dailySeconds = safeParseInt(daily, 0);
        } catch (dailyError) {
          console.warn('[ScreenTimeContext] Failed to get daily time:', dailyError);
        }

        // Use the maximum value (most recent data)
        const maxSeconds = Math.max(nativeSeconds, cachedSeconds, dailySeconds);
        
        if (maxSeconds > 0) {
          setScreenTimeSeconds(maxSeconds);
          console.log(`[ScreenTimeContext] Loaded ${maxSeconds}s on mount (native: ${nativeSeconds}s, cache: ${cachedSeconds}s, daily: ${dailySeconds}s)`);
        } else {
          console.log(`[ScreenTimeContext] No cached data found on mount`);
        }
      } catch (e) {
        console.warn('[ScreenTimeContext] Failed to load initial time', e);
      }
    };

    loadInitialTime();
  }, [checkPermission]);

  // Monitor auth state and handle user changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const newUserId = user?.uid || null;

      // Only clear data if:
      // 1. We had a previous user (currentUserId !== null)
      // 2. AND the user actually changed (switched accounts)
      // 3. OR user logged out (newUserId is null)
      // This prevents clearing on first login
      if (currentUserId !== null && currentUserId !== newUserId) {
        console.log('[ScreenTimeContext] User switched/logged out - clearing local data');
        await clearLocalData();
        ScreenTimeSyncService.cleanup();
        initializedRef.current = false;
      }

      setCurrentUserId(newUserId);

      if (user) {
        // First, ALWAYS fetch screen time from Firestore on login
        try {
          console.log('[ScreenTimeContext] User logged in - fetching screen time from database...');
          
          // Fetch from Firestore FIRST (regardless of face verification status)
          await ScreenTimeSyncService.initialize();
          console.log('[ScreenTimeContext] ✅ Screen time fetched from database');
          
          // IMMEDIATELY load the fetched data (don't wait)
          const today = new Date();
          const dailyKey = `screenTime_${today.toDateString()}`;
          const storedData = await SafeAsyncStorage.getItem(dailyKey);
          
          if (storedData) {
            const seconds = safeParseInt(storedData, 0);
            if (seconds >= 0) {
              // ALWAYS display the data (both verified and unverified users)
              setScreenTimeSeconds(seconds);
              console.log(`[ScreenTimeContext] ✅ Loaded ${seconds}s from Firestore data for display`);
            }
          } else {
            console.log('[ScreenTimeContext] ⚠️ No Firestore data found for today');
            // Check native module as fallback
            try {
              const nativeSeconds = await ScreenTimeTracker?.getTodayScreenTime?.() || 0;
              if (nativeSeconds > 0) {
                setScreenTimeSeconds(nativeSeconds);
                console.log(`[ScreenTimeContext] ✅ Loaded ${nativeSeconds}s from native module`);
              }
            } catch (e) {
              console.warn('[ScreenTimeContext] Failed to get native time:', e);
            }
          }
          
          // NOW check face verification status
          const faceVerified = await AsyncStorage.getItem('faceVerificationCompleted');
          
          if (faceVerified === 'true') {
            console.log('[ScreenTimeContext] Face verified - keeping cache for persistent display');
            // Cache remains for quick access on next app start
            // User will navigate to main dashboard (handled by face-verification.tsx)
          } else {
            console.log('[ScreenTimeContext] Face verification pending - will clear cache after verification fails');
            
            // DON'T clear cache here - let face-verification.tsx handle it
            // Data is already displayed above, cache will be cleared only if verification fails
            // (handled by face-verification.tsx on verification failure)
            console.log('[ScreenTimeContext] ✅ Data displayed - awaiting face verification result');
            // User will be shown face verification screen (navigation handled elsewhere)
          }
        } catch (error) {
          console.warn('[ScreenTimeContext] Failed to fetch screen time:', error);
        }
        
        // Initialize screen time tracking (only if face verified)
        await initializeScreenTimeIfReady();
      } else {
        // User logged out - cleanup
        console.log('[ScreenTimeContext] User logged out - cleaning up');
        ScreenTimeSyncService.cleanup();
        initializedRef.current = false;
        await clearLocalData();
      }
    });

    return () => {
      unsubscribe();
      ScreenTimeSyncService.cleanup();
    };
  }, [currentUserId, initializeScreenTimeIfReady, clearLocalData]);

  // Setup periodic updates (every second) - only when logged in
  useEffect(() => {
    // Don't start updates if user is not logged in
    if (!currentUserId) {
      console.log('[ScreenTimeContext] No user logged in - skipping periodic updates');
      return;
    }

    const startUpdates = () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }

      // Always use consistent 1-second interval for smooth display
      updateIntervalRef.current = setInterval(() => {
        refreshScreenTime();
      }, UPDATE_INTERVAL);
    };

    const stopUpdates = () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };

    // Start updates immediately
    startUpdates();

    // Handle app state changes (foreground/background)
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - quick resume
        console.log('[ScreenTimeContext] App foregrounded - resuming updates');
        
        // Start updates immediately for responsive UI
        startUpdates();
        
        // Android 13+ fix: Re-check permission when returning from settings
        if (Platform.OS === 'android') {
          await checkPermission();
          console.log('[ScreenTimeContext] Permission re-checked on foreground');
        }
        
        // Quick check and restart tracking (non-blocking)
        (async () => {
          try {
            let running = (await NativeScreenTrackingService.getStatus()).isTracking;
            setIsTracking(!!running);
            
            if (!running) {
              console.log('[ScreenTimeContext] Restarting tracking on foreground...');
              await NativeScreenTrackingService.startTracking();
              const status = await NativeScreenTrackingService.getStatus();
              running = status.isTracking;
              setIsTracking(!!running);
              console.log('[ScreenTimeContext] Tracking status after restart:', running);
            }
            // Quick refresh from native
            await refreshScreenTime();
          } catch (e) {
            console.warn('[ScreenTimeContext] Foreground resume error:', e);
          }
        })();
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        // App went to background - continue updates
        console.log('[ScreenTimeContext] App backgrounded - continuing updates');
        startUpdates();
      }

      appState.current = nextAppState;
    });

    return () => {
      stopUpdates();
      subscription.remove();
    };
  }, [currentUserId, refreshScreenTime, checkTrackingStatus, initializeScreenTimeIfReady]);

  const value: ScreenTimeContextValue = {
    screenTimeSeconds,
    isTracking,
    formattedTime,
    startTracking,
    stopTracking,
    refreshScreenTime,
    hasPermission,
    isLoading,
    requestPermission,
  };

  return (
    <ScreenTimeContext.Provider value={value}>
      {children}
    </ScreenTimeContext.Provider>
  );
};

/**
 * Hook to access global screen time
 * 
 * @example
 * const { screenTimeSeconds, formattedTime, isTracking } = useScreenTime();
 */
export const useScreenTime = (): ScreenTimeContextValue => {
  const context = useContext(ScreenTimeContext);
  if (context === undefined) {
    throw new Error('useScreenTime must be used within ScreenTimeProvider');
  }
  return context;
};

// Helper function for formatting time
function formatHhMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

/**
 * Hook for daily screen time usage statistics
 * Powers DailyScreenTimeCard and AppUsageList components
 */
export const useDailyScreenTime = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<MaybeError>(null);
  const [usage, setUsage] = useState<DailyUsage>({ totalScreenTime: 0, usageByApp: [] });

  const refresh = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setUsage({ totalScreenTime: 0, usageByApp: [] });
      setError('Screen time tracking is only available on Android');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const list: DailyUsageAppItem[] = await NativeUsageStats.getTodayUsageStats();
      const sorted = [...list].sort((a, b) => b.totalTimeInForeground - a.totalTimeInForeground);
      const totalSeconds = Math.round(sorted.reduce((sum, it) => sum + it.totalTimeInForeground, 0) / 1000);
      setUsage({ totalScreenTime: totalSeconds, usageByApp: sorted });
    } catch (e) {
      setError('Failed to read usage stats');
      setUsage({ totalScreenTime: 0, usageByApp: [] });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const formattedTime = useMemo(() => formatHhMmSs(usage.totalScreenTime), [usage.totalScreenTime]);
  const appsCount = usage.usageByApp.length;
  const mostUsedApp = usage.usageByApp[0] ?? null;

  return {
    formattedTime,
    appsCount,
    mostUsedApp,
    usage,
    isLoading,
    error,
    refresh,
  };
};

/**
 * Hook for weekly screen time usage statistics
 * Powers WeeklyScreenTimeSummary component
 */
export const useWeeklyScreenTime = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<MaybeError>(null);
  const [usage, setUsage] = useState<Array<{ totalScreenTime: number }>>(
    new Array(7).fill(0).map(() => ({ totalScreenTime: 0 }))
  );

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get current user ID
      const user = auth.currentUser;
      if (!user) {
        setError('User not authenticated');
        setUsage(new Array(7).fill(0).map(() => ({ totalScreenTime: 0 })));
        return;
      }
      
      // Build last 7 dates Sun..Sat order to align with UI labels
      const today = new Date();
      const startOfWeek = new Date(today);
      // Move to last Sunday
      startOfWeek.setDate(today.getDate() - today.getDay());

      const days: Date[] = [...Array(7)].map((_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
      });

      // Keys used by ScreenTimeSyncService: screenTime_<userId>_<toDateString>
      const keys = days.map(d => `screenTime_${user.uid}_${d.toDateString()}`);
      const kvs = await AsyncStorage.multiGet(keys);

      const values = kvs.map(([, v]) => ({ totalScreenTime: v ? Number(v) || 0 : 0 }));
      setUsage(values);
    } catch (e) {
      setError('Failed to load weekly usage');
      setUsage(new Array(7).fill(0).map(() => ({ totalScreenTime: 0 })));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const totalSeconds = useMemo(() => usage.reduce((s, d) => s + d.totalScreenTime, 0), [usage]);
  const avgSeconds = Math.round(totalSeconds / 7);

  const formattedTotalTime = useMemo(() => formatHhMmSs(totalSeconds), [totalSeconds]);
  const formattedAverageTime = useMemo(() => formatHhMmSs(avgSeconds), [avgSeconds]);

  return {
    usage,
    formattedTotalTime,
    formattedAverageTime,
    isLoading,
    error,
    refresh,
  };
};

export default ScreenTimeContext;

