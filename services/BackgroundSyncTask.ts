import { AppRegistry } from 'react-native';
import NativeScreenTrackingService from './NativeScreenTrackingService';
import ScreenTimeSyncService from './ScreenTimeSyncService';

const BackgroundSyncTask = async () => {
  try {
    console.log('[BackgroundSyncTask] Starting background sync...');

    // Get current screen time
    const status = await NativeScreenTrackingService.getStatus();
    const today = new Date().toISOString().slice(0, 10);

    // Trigger sync via ScreenTimeSyncService
    const payload = {
      totalSeconds: status.totalSeconds,
      date: today,
    };

    // This will upload to Firebase
    await ScreenTimeSyncService.syncNow();

    console.log(`[BackgroundSyncTask] Synced ${status.totalSeconds}s to Firebase`);
  } catch (e) {
    console.warn('[BackgroundSyncTask] Background sync failed', e);
  }
};

// Register the background task
AppRegistry.registerHeadlessTask('BackgroundSync', () => BackgroundSyncTask);

export default BackgroundSyncTask;

