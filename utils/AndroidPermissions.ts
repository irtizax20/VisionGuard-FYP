/**
 * Android Permission Handler
 * Handles Android 13+ specific permissions
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Request notification permissions for Android 13+
 * This is mandatory on Android 13+ or app will crash
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    // Only needed for Android 13+ (API 33+)
    if (Platform.OS !== 'android') {
      return true;
    }

    const androidVersion = Platform.Version;
    console.log(`📱 Android version: ${androidVersion}`);

    // Android 13+ requires explicit notification permission
    if (androidVersion >= 33) {
      console.log('🔔 Requesting notification permission (Android 13+)...');
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('⚠️ Notification permission denied');
        return false;
      }

      console.log('✅ Notification permission granted');
      return true;
    }

    // Android < 13 doesn't need runtime permission
    console.log('✅ Notification permission not required (Android < 13)');
    return true;
  } catch (error) {
    console.error('❌ Error requesting notification permission:', error);
    return false;
  }
};

/**
 * Initialize Android permissions on app startup
 * Call this in _layout.tsx or App.tsx
 */
export const initializeAndroidPermissions = async (): Promise<void> => {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    console.log('🔧 Initializing Android permissions...');
    
    // Request notification permission first (critical for Android 13+)
    await requestNotificationPermission();
    
    console.log('✅ Android permissions initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Android permissions:', error);
  }
};
