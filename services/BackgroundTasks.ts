
import AsyncStorage from '@react-native-async-storage/async-storage';

// DEPRECATED WARNING: expo-background-fetch is deprecated, use expo-background-task instead
// This file is kept for backward compatibility but wrapped in error handling
// TODO: Migrate to expo-background-task in future update

try {
  // Dynamically import to prevent crashes on Android 13+ where this may fail
  const BackgroundFetch = require('expo-background-fetch');
  const TaskManager = require('expo-task-manager');
  const { auth } = require('../firebase/firebaseConfig');

  const BACKGROUND_SYNC_TASK = 'background-screen-time-sync';
  const LAST_SYNC_KEY = 'last_background_sync';

  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
      console.log('[BackgroundTask] Starting background sync...');
      
      // Check if user is authenticated
      if (!auth.currentUser) {
        console.log('[BackgroundTask] User not authenticated, skipping');
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }

      // Update last sync time
      await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
      
      // Import services dynamically to avoid circular dependencies
      const { default: ScreenTimeSyncService } = await import('./ScreenTimeSyncService');
      
      // Perform sync
      const result = await ScreenTimeSyncService.syncNow();
      
      console.log(`[BackgroundTask] Sync completed: ${result ? 'SUCCESS' : 'FAILED'}`);
      
      return result 
        ? BackgroundFetch.BackgroundFetchResult.NewData 
        : BackgroundFetch.BackgroundFetchResult.Failed;
        
    } catch (error) {
      console.error('[BackgroundTask] Error:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });

  console.log('✅ Background tasks defined');
} catch (error) {
  console.warn('⚠️ BackgroundTasks failed to initialize (deprecated expo-background-fetch):', error);
  console.log('ℹ️ Foreground sync will continue working. Consider migrating to expo-background-task.');
}
