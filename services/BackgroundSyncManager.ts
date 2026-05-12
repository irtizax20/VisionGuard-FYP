
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { auth } from '../firebase/firebaseConfig';
import NativeUsageStats from '../src/services/NativeUsageStats';
import NativeScreenTrackingService from './NativeScreenTrackingService';
import OfflineSyncService from './OfflineSyncService';
import ScreenTimeSyncService from './ScreenTimeSyncService';

// Background task name
const BACKGROUND_SYNC_TASK = 'background-screen-time-sync';

// Storage keys
const LAST_SYNC_KEY = 'last_background_sync';
const SYNC_SETTINGS_KEY = 'background_sync_settings';
const SYNC_STATS_KEY = 'background_sync_stats';

export interface BackgroundSyncSettings {
  enabled: boolean;
  syncInterval: number; // in minutes
  wifiOnly: boolean;
  batteryOptimized: boolean;
  minBatteryLevel: number; // percentage
  syncOnAppClose: boolean;
  syncOnNetworkChange: boolean;
}

export interface BackgroundSyncStats {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  lastSyncTime: number | null;
  lastSyncDuration: number; // in ms
  averageSyncDuration: number;
  dataSynced: number; // in bytes
}

class BackgroundSyncManager {
  private static instance: BackgroundSyncManager;
  private static taskDefined: boolean = false;
  private isRegistered: boolean = false;
  private appState: AppStateStatus = AppState.currentState;
  private appStateSubscription: any = null;
  private networkUnsubscribe: (() => void) | null = null;
  
  private settings: BackgroundSyncSettings = {
    enabled: true, // Auto-disabled on Android 13+ during initialize()
    syncInterval: 15, // 15 minutes (minimum for iOS)
    wifiOnly: false,
    batteryOptimized: true,
    minBatteryLevel: 20, // Don't sync if battery below 20%
    syncOnAppClose: true,
    syncOnNetworkChange: true,
  };

  private stats: BackgroundSyncStats = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    lastSyncTime: null,
    lastSyncDuration: 0,
    averageSyncDuration: 0,
    dataSynced: 0,
  };

  static getInstance(): BackgroundSyncManager {
    if (!BackgroundSyncManager.instance) {
      BackgroundSyncManager.instance = new BackgroundSyncManager();
    }
    return BackgroundSyncManager.instance;
  }

  // Initialize the background sync manager
  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing Background Sync Manager...');
      
      // Check Android version FIRST - disable background sync on Android 13+ (API 33+)
      if (Platform.OS === 'android') {
        const androidVersion = Platform.Version;
        console.log(`📱 Android API Level: ${androidVersion}`);
        
        if (androidVersion >= 33) {
          console.log('📱 Android 13+ detected - Background sync FORCE DISABLED (using foreground sync only)');
          
          // Load settings first
          await this.loadSettings();
          await this.loadStats();
          
          // Force disable and save (override any previous settings)
          this.settings.enabled = false;
          await this.saveSettings();
          
          // Skip everything else - no background tasks on Android 13+
          console.log('⏭️ Skipping background task registration, app state listener, and network listener');
          return;
        }
      }
      
      // Load settings normally for Android < 13 or iOS
      await this.loadSettings();
      await this.loadStats();
      
      // Register background task if enabled (only for Android < 13 or iOS)
      if (this.settings.enabled) {
        try {
          await this.registerBackgroundTask();
        } catch (taskError) {
          console.warn('⚠️ Background task registration failed (deprecated library):', taskError);
          // Continue without background sync - foreground sync will still work
        }
      }
      
      // Setup app state listener for sync on app close
      this.setupAppStateListener();
      
      // Setup network listener for sync on network change
      if (this.settings.syncOnNetworkChange) {
        this.setupNetworkListener();
      }
      
      console.log('✅ Background Sync Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Background Sync Manager:', error);
    }
  }

  // Register the background fetch task
  async registerBackgroundTask(): Promise<void> {
    try {
      // Check if task is already registered
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
      
      if (isRegistered) {
        console.log('📌 Background sync task already registered');
        this.isRegistered = true;
        return;
      }

      // Define the background task (guarded so it's defined only once)
      if (!BackgroundSyncManager.taskDefined) {
        TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
        try {
          console.log('[BackgroundSync] Starting background sync task...');
          const startTime = Date.now();
          
          // Check if user is authenticated
          if (!auth.currentUser) {
            console.log('[BackgroundSync] User not authenticated, skipping sync');
            return BackgroundFetch.BackgroundFetchResult.NoData;
          }

          // Check conditions before syncing
          const canSync = await this.checkSyncConditions();
          if (!canSync) {
            console.log('[BackgroundSync] Sync conditions not met, skipping');
            return BackgroundFetch.BackgroundFetchResult.NoData;
          }

          // Perform the sync
          const syncResult = await this.performSync();
          
          // Update stats
          const duration = Date.now() - startTime;
          await this.updateStats(syncResult.success, duration, syncResult.dataSize);
          
          console.log(`[BackgroundSync] Completed in ${duration}ms, result: ${syncResult.success ? 'SUCCESS' : 'FAILED'}`);
          
          return syncResult.success 
            ? BackgroundFetch.BackgroundFetchResult.NewData 
            : BackgroundFetch.BackgroundFetchResult.Failed;
        } catch (error) {
          console.error('[BackgroundSync] Error:', error);
          await this.updateStats(false, 0, 0);
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });
        BackgroundSyncManager.taskDefined = true;
      }

      // Register the background fetch task
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: this.settings.syncInterval * 60, // Convert to seconds
        stopOnTerminate: false, // Continue running after app is closed
        startOnBoot: true, // Start on device reboot
      });

      this.isRegistered = true;
      console.log(`✅ Background sync task registered (interval: ${this.settings.syncInterval} min)`);
    } catch (error) {
      console.error('❌ Failed to register background task:', error);
      this.isRegistered = false;
    }
  }

  // Unregister the background task
  async unregisterBackgroundTask(): Promise<void> {
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
      this.isRegistered = false;
      console.log('✅ Background sync task unregistered');
    } catch (error) {
      console.error('❌ Failed to unregister background task:', error);
    }
  }

  // Check if conditions are met for syncing
  private async checkSyncConditions(): Promise<boolean> {
    try {
      // Check network connectivity
      const networkState = await NetInfo.fetch();
      
      if (!networkState.isConnected) {
        console.log('[SyncCheck] No network connection');
        return false;
      }

      // Check if WiFi-only is enabled and we're not on WiFi
      if (this.settings.wifiOnly && networkState.type !== 'wifi') {
        console.log('[SyncCheck] WiFi-only enabled but not on WiFi');
        return false;
      }

      // Check battery level (only on Android)
      if (Platform.OS === 'android' && this.settings.batteryOptimized) {
        // Note: Battery level checking requires expo-battery
        // For now, we'll assume it's okay
        // TODO: Add expo-battery package and check battery level
      }

      // Check minimum time since last sync (prevent too frequent syncs)
      const lastSyncStr = await AsyncStorage.getItem(LAST_SYNC_KEY);
      if (lastSyncStr) {
        const lastSync = parseInt(lastSyncStr, 10);
        const timeSinceLastSync = Date.now() - lastSync;
        const minInterval = this.settings.syncInterval * 60 * 1000; // Convert to ms
        
        if (timeSinceLastSync < minInterval * 0.8) { // 80% of interval
          console.log(`[SyncCheck] Too soon since last sync (${Math.round(timeSinceLastSync / 1000)}s ago)`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('[SyncCheck] Error checking sync conditions:', error);
      return false;
    }
  }

  // Perform the actual sync operation
  private async performSync(): Promise<{ success: boolean; dataSize: number }> {
    let dataSize = 0;
    
    try {
      // 1. Read screen time using native status or fallback to UsageStats
      const status = await NativeScreenTrackingService.getStatus();
      const todayISO = new Date().toISOString().slice(0, 10);

      let totalSeconds = status.totalSeconds || 0;
      if (totalSeconds <= 0) {
        try {
          const list = await NativeUsageStats.getTodayUsageStats();
          totalSeconds = Math.round(list.reduce((sum: number, it: { totalTimeInForeground: number }) => sum + (it.totalTimeInForeground || 0), 0) / 1000);
        } catch (_) {
          // ignore
        }
      }

      // Persist locally for UI/Report
      try {
        const today = new Date();
        await AsyncStorage.setItem(`screenTime_${today.toDateString()}`, String(totalSeconds));
        await AsyncStorage.setItem('global_screen_time_cache', String(totalSeconds));
      } catch (_) {}
      
      if (totalSeconds > 0) {
        // Upload to Firebase via ScreenTimeSyncService using forceSync
        await ScreenTimeSyncService.forceSync();
        dataSize += JSON.stringify({ totalSeconds, date: todayISO }).length;
        
        console.log(`[Sync] Screen time synced: ${totalSeconds}s`);
      }

      // 2. Sync offline queue via OfflineSyncService
      const offlineSyncService = OfflineSyncService;
      const syncStatus = offlineSyncService.getSyncStatus();
      
      if (syncStatus.queueSize > 0) {
        await offlineSyncService.forcSync();
        console.log(`[Sync] Offline queue synced: ${syncStatus.queueSize} items`);
      }

      // Update last sync time
      await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());

      return { success: true, dataSize };
    } catch (error) {
      console.error('[Sync] Error performing sync:', error);
      return { success: false, dataSize: 0 };
    }
  }

  // Setup app state listener
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', async (nextState) => {
      const previousState = this.appState;
      this.appState = nextState;

      // Sync when app goes to background if enabled
      if (
        this.settings.syncOnAppClose &&
        previousState === 'active' &&
        (nextState === 'background' || nextState === 'inactive')
      ) {
        console.log('📱 App going to background, triggering sync...');
        await this.triggerImmediateSync();
      }
    });
  }

  // Setup network listener
  private setupNetworkListener(): void {
    this.networkUnsubscribe = NetInfo.addEventListener(async (state) => {
      // Trigger sync when we come back online
      if (state.isConnected && this.settings.syncOnNetworkChange) {
        console.log('🌐 Network connected, triggering sync...');
        await this.triggerImmediateSync();
      }
    });
  }

  // Trigger immediate sync (respecting conditions)
  async triggerImmediateSync(): Promise<boolean> {
    try {
      const canSync = await this.checkSyncConditions();
      if (!canSync) {
        console.log('⚠️ Sync conditions not met for immediate sync');
        return false;
      }

      const startTime = Date.now();
      const syncResult = await this.performSync();
      const duration = Date.now() - startTime;
      
      await this.updateStats(syncResult.success, duration, syncResult.dataSize);
      
      console.log(`✅ Immediate sync completed: ${syncResult.success ? 'SUCCESS' : 'FAILED'}`);
      return syncResult.success;
    } catch (error) {
      console.error('❌ Immediate sync failed:', error);
      await this.updateStats(false, 0, 0);
      return false;
    }
  }

  // Update sync statistics
  private async updateStats(
    success: boolean,
    duration: number,
    dataSize: number
  ): Promise<void> {
    try {
      this.stats.totalSyncs++;
      
      if (success) {
        this.stats.successfulSyncs++;
        this.stats.lastSyncTime = Date.now();
        this.stats.lastSyncDuration = duration;
        this.stats.dataSynced += dataSize;
        
        // Calculate moving average for sync duration
        const totalDuration = this.stats.averageSyncDuration * (this.stats.successfulSyncs - 1) + duration;
        this.stats.averageSyncDuration = Math.round(totalDuration / this.stats.successfulSyncs);
      } else {
        this.stats.failedSyncs++;
      }

      await this.saveStats();
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  // Update settings
  async updateSettings(newSettings: Partial<BackgroundSyncSettings>): Promise<void> {
    try {
      const oldSettings = { ...this.settings };
      this.settings = { ...this.settings, ...newSettings };
      
      await this.saveSettings();
      
      // Re-register task if interval or enabled status changed
      if (
        oldSettings.enabled !== this.settings.enabled ||
        oldSettings.syncInterval !== this.settings.syncInterval
      ) {
        if (this.settings.enabled) {
          await this.unregisterBackgroundTask();
          await this.registerBackgroundTask();
        } else {
          await this.unregisterBackgroundTask();
        }
      }
      
      // Update network listener
      if (oldSettings.syncOnNetworkChange !== this.settings.syncOnNetworkChange) {
        if (this.settings.syncOnNetworkChange) {
          this.setupNetworkListener();
        } else if (this.networkUnsubscribe) {
          this.networkUnsubscribe();
          this.networkUnsubscribe = null;
        }
      }
      
      console.log('✅ Background sync settings updated');
    } catch (error) {
      console.error('❌ Failed to update settings:', error);
    }
  }

  // Get current settings
  getSettings(): BackgroundSyncSettings {
    return { ...this.settings };
  }

  // Get sync statistics
  getStats(): BackgroundSyncStats {
    return { ...this.stats };
  }

  // Check if background sync is registered
  isBackgroundSyncRegistered(): boolean {
    return this.isRegistered;
  }

  // Get status information
  async getStatus(): Promise<{
    isRegistered: boolean;
    settings: BackgroundSyncSettings;
    stats: BackgroundSyncStats;
    canSyncNow: boolean;
  }> {
    const canSyncNow = await this.checkSyncConditions();
    
    return {
      isRegistered: this.isRegistered,
      settings: this.getSettings(),
      stats: this.getStats(),
      canSyncNow,
    };
  }

  // Reset statistics
  async resetStats(): Promise<void> {
    this.stats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      lastSyncTime: null,
      lastSyncDuration: 0,
      averageSyncDuration: 0,
      dataSynced: 0,
    };
    await this.saveStats();
    console.log('✅ Sync statistics reset');
  }

  // Save settings to storage
  private async saveSettings(): Promise<void> {
    await AsyncStorage.setItem(SYNC_SETTINGS_KEY, JSON.stringify(this.settings));
  }

  // Load settings from storage
  private async loadSettings(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem(SYNC_SETTINGS_KEY);
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  // Save stats to storage
  private async saveStats(): Promise<void> {
    await AsyncStorage.setItem(SYNC_STATS_KEY, JSON.stringify(this.stats));
  }

  // Load stats from storage
  private async loadStats(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem(SYNC_STATS_KEY);
      if (saved) {
        this.stats = { ...this.stats, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      if (this.appStateSubscription) {
        this.appStateSubscription.remove?.();
        this.appStateSubscription = null;
      }

      if (this.networkUnsubscribe) {
        this.networkUnsubscribe();
        this.networkUnsubscribe = null;
      }

      console.log('✅ Background Sync Manager cleaned up');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }
}

export default BackgroundSyncManager;

