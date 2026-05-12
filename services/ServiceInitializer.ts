/**
 * Centralized service initialization manager
 * Ensures services are initialized only once
 */

import { doc, getDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { auth, db } from '../firebase/firebaseConfig';
// DON'T import BackgroundSyncManager statically - load conditionally to avoid Android 13+ crashes
// import BackgroundSyncManager from './BackgroundSyncManager'; // ❌ Commented out
import BlinkTrackingService from './BlinkTrackingService';
import BrightnessService from './BrightnessService';
import NativeScreenTrackingService from './NativeScreenTrackingService';
import ScreenBreakService from './ScreenBreakService';
import ScreenTimeSyncService from './ScreenTimeSyncService';

class ServiceInitializer {
  private static instance: ServiceInitializer;
  private isInitialized = false;
  private isInitializing = false;

  private constructor() {}

  static getInstance(): ServiceInitializer {
    if (!ServiceInitializer.instance) {
      ServiceInitializer.instance = new ServiceInitializer();
    }
    return ServiceInitializer.instance;
  }

  /**
   * Initialize all app services (once per app lifecycle)
   * Protected with timeout to prevent hanging main page
   */
  async initializeServices(): Promise<void> {
    // Prevent duplicate initialization
    if (this.isInitialized || this.isInitializing) {
      console.log('⏭️ Services already initialized or initializing, skipping...');
      return;
    }

    try {
      this.isInitializing = true;

      // CRITICAL: Wrap entire initialization in timeout (15 seconds max)
      await Promise.race([
        this._initializeServicesInternal(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Service initialization timeout (15s)')), 15000)
        )
      ]);
      
      this.isInitialized = true;
      console.log('✅ All app services initialized successfully');
    } catch (error) {
      console.warn('⚠️ Service initialization completed with errors (non-critical):', error);
      this.isInitialized = true; // Mark as initialized anyway to prevent re-attempts
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Internal initialization logic (all services)
   */
  private async _initializeServicesInternal(): Promise<void> {
    try {
      // Check if face verification is completed (TEMPORARILY DISABLED FOR TESTING)
      // const faceVerified = await AsyncStorage.getItem('faceVerificationCompleted');
      // if (faceVerified !== 'true') {
      //   console.log('⏸️ Waiting for face verification before initializing services...');
      //   this.isInitializing = false;
      //   return;
      // }

      console.log('🚀 Initializing all app services...');

      // Initialize Screen Time Sync Service FIRST (fetches data from Firestore)
      try {
        console.log('[ServiceInitializer] Initializing ScreenTimeSyncService...');
        await Promise.race([
          ScreenTimeSyncService.initialize(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        console.log('[ServiceInitializer] ✅ ScreenTimeSyncService initialized');
      } catch (syncError) {
        console.warn('[ServiceInitializer] ⚠️ ScreenTimeSyncService failed (non-critical):', syncError);
      }

      // Check and rotate blink tracking weeks if needed
      try {
        console.log('[ServiceInitializer] Checking BlinkTrackingService week rotation...');
        await Promise.race([
          BlinkTrackingService.checkAndRotateWeeks(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        console.log('[ServiceInitializer] ✅ BlinkTrackingService rotation check complete');
      } catch (blinkError) {
        console.warn('[ServiceInitializer] ⚠️ BlinkTrackingService rotation failed (non-critical):', blinkError);
      }

      // Initialize Brightness Service
      try {
        const brightnessService = BrightnessService.getInstance();
        await Promise.race([
          brightnessService.initialize(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
      } catch (brightnessError) {
        console.warn('[ServiceInitializer] ⚠️ BrightnessService failed (non-critical):', brightnessError);
      }

      // Load and set break interval from Firebase
      const currentUser = (() => {
        try {
          return auth?.currentUser ?? null;
        } catch (error) {
          console.warn('[ServiceInitializer] Unable to access auth currentUser:', error);
          return null;
        }
      })();

      if (Platform.OS === 'android' && currentUser) {
        try {
          await Promise.race([
            (async () => {
              const userDoc = await getDoc(doc(db, 'user', currentUser.uid));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                const screenBreakInterval = userData.screenBreakInterval || '2';
                const intervalMinutes = parseInt(screenBreakInterval, 10);

                if (!isNaN(intervalMinutes) && intervalMinutes > 0) {
                  await ScreenBreakService.setBreakInterval(intervalMinutes);
                  console.log(`[ServiceInitializer] ✅ Break interval set to ${intervalMinutes} minutes`);
                }
              }
            })(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]);
        } catch (error) {
          console.warn('[ServiceInitializer] ⚠️ Failed to load break interval (non-critical):', error);
        }
      }

      // DON'T start native screen tracking here - let Main dashboard handle it after permission
      // Note: Usage Access permission is requested on Main dashboard first
      if (Platform.OS === 'android') {
        try {
          console.log('[ServiceInitializer] Checking native tracking status...');
          
          let status: any;
          try {
            status = await Promise.race([
              NativeScreenTrackingService.getStatus(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
            ]);
          } catch (statusError) {
            console.warn('[ServiceInitializer] ⚠️ Failed to get native status (timeout or error):', statusError);
            // Continue without native tracking - Main dashboard will handle it
            status = null;
          }
          
          if (!status) {
            console.log('[ServiceInitializer] ⚠️ Native module not available yet - Main dashboard will initialize it');
          } else {
            console.log(`[ServiceInitializer] Current status - isTracking: ${status.isTracking}, hasPermission: ${status.hasUsageAccess}, totalSeconds: ${status.totalSeconds}`);
            
            if (!status.hasUsageAccess) {
              console.log('[ServiceInitializer] ⚠️ Usage Access permission NOT granted - Main dashboard will request it');
              
              // CRITICAL: If tracking is running WITHOUT permission, stop it to prevent crashes
              if (status.isTracking) {
                console.log('[ServiceInitializer] 🛑 STOPPING invalid tracking (running without permission)');
                try {
                  await Promise.race([
                    NativeScreenTrackingService.stopTracking(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                  ]);
                  console.log('[ServiceInitializer] ✅ Invalid tracking stopped');
                } catch (stopError) {
                  console.warn('[ServiceInitializer] ⚠️ Failed to stop invalid tracking (non-critical):', stopError);
                }
              }
            } else {
              console.log('[ServiceInitializer] ✅ Usage Access permission already granted');
              
              // Only start tracking if permission is already granted
              if (!status.isTracking) {
                try {
                  console.log('[ServiceInitializer] Starting native tracking...');
                  await Promise.race([
                    NativeScreenTrackingService.startTracking(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                  ]);
                  console.log('[ServiceInitializer] ✅ Tracking started');
                } catch (startError) {
                  console.warn('[ServiceInitializer] ⚠️ Failed to start tracking (non-critical):', startError);
                  // Non-critical - Main dashboard will retry
                }
              }
            }
          }
        } catch (error) {
          console.warn('[ServiceInitializer] ⚠️ Error checking native tracking (non-critical):', error);
          // Non-critical error - app can continue without native tracking
        }
      }

      // Initialize Background Sync Manager
      try {
        // Load and initialize BackgroundSyncManager
        const BackgroundSyncManager = require('./BackgroundSyncManager').default;
        const syncManager = BackgroundSyncManager.getInstance();
        await Promise.race([
          syncManager.initialize(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        console.log('[ServiceInitializer] ✅ BackgroundSyncManager initialized');
      } catch (syncError) {
        console.warn('[ServiceInitializer] ⚠️ BackgroundSyncManager failed to initialize (non-critical):', syncError);
        // Non-critical - foreground sync will continue working
      }
    } catch (error) {
      console.error('❌ Service initialization internal error:', error);
      throw error; // Propagate to main handler
    }
  }

  /**
   * Reset initialization state (e.g., on logout)
   */
  reset(): void {
    console.log('🔄 Resetting service initializer state');
    this.isInitialized = false;
    this.isInitializing = false;
  }

  /**
   * Check if services are initialized
   */
  areServicesInitialized(): boolean {
    return this.isInitialized;
  }
}

export default ServiceInitializer;

