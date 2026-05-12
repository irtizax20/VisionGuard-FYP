import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from '../components/ErrorBoundary';
import { ScreenTimeProvider } from '../contexts/ScreenTimeContext';
import { auth } from '../firebase/firebaseConfig';
import { applyFirestorePatches } from '../firebase/firestorePatch';
import { ThemeProvider } from '../hooks/ThemeContext';
import { useTheme } from '../hooks/useTheme';
import ServiceInitializer from '../services/ServiceInitializer';
import { initializeAndroidPermissions } from '../utils/AndroidPermissions';

// Global error handlers to prevent app crashes
if (typeof (global as any).ErrorUtils !== 'undefined') {
  const originalHandler = (global as any).ErrorUtils.getGlobalHandler();
  (global as any).ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    console.error('🚨 Global error caught:', error, 'Fatal:', isFatal);
    if (!isFatal) {
      // Log non-fatal errors but don't crash
      return;
    }
    // Let fatal errors through to default handler
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

// Catch unhandled promise rejections
if (typeof Promise !== 'undefined') {
  const originalRejectionHandler = Promise.prototype.catch;
  global.addEventListener?.('unhandledrejection', (event) => {
    console.error('🚨 Unhandled promise rejection:', event.reason);
    event.preventDefault(); // Prevent app crash
  });
}

// Safely import background tasks (skip on Android 13+ where expo-background-fetch crashes)
try {
  const { Platform } = require('react-native');
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    require('../services/BackgroundTasks');
    console.log('✅ BackgroundTasks imported');
  } else {
    console.log('📱 Android 13+ detected - Skipping BackgroundTasks (deprecated library)');
  }
} catch (error) {
  console.warn('⚠️ BackgroundTasks failed to import (non-critical):', error);
}

function ThemedApp() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    // Initialize Android 13+ permissions FIRST (critical!)
    try {
      initializeAndroidPermissions();
    } catch (error) {
      console.error('❌ Permission initialization failed:', error);
    }
    
    // Global patches (safe before login)
    try {
      applyFirestorePatches();
    } catch (error) {
      console.error('❌ Firestore patches failed:', error);
    }

    const serviceInitializer = ServiceInitializer.getInstance();

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // Only start heavy/background services once user is logged in AND face verified
          try {
            const faceVerified = await AsyncStorage.getItem('faceVerificationCompleted');

            if (faceVerified === 'true') {
              console.log('✅ User authenticated and face verified, initializing services');
              await serviceInitializer.initializeServices();
            } else {
              console.log('⚠️ User authenticated but face verification pending, services not initialized');
            }
          } catch (error) {
            console.error('❌ Error checking face verification status:', error);
          }
        } else {
          // User logged out – reset service initializer
          try {
            serviceInitializer.reset();
          } catch (error) {
            console.error('❌ Error resetting services:', error);
          }
        }
      } catch (error) {
        console.error('❌ Critical auth state change error:', error);
      }
    });

    // Also attempt initialization whenever app returns to foreground (Android 13+ safe)
    const appStateSub = AppState.addEventListener('change', async (state) => {
      if (state === 'active' && auth.currentUser) {
        console.log('🔄 App became active, re-checking permission...');
        try {
          const faceVerified = await AsyncStorage.getItem('faceVerificationCompleted');

          if (faceVerified === 'true') {
            // Only initialize if not already initialized (prevent redundant calls)
            if (!serviceInitializer.areServicesInitialized()) {
              console.log('⚙️ Services not initialized, initializing now...');
              await serviceInitializer.initializeServices();
            } else {
              console.log('⏭️ Services already initialized or initializing, skipping...');
            }
          }
        } catch (error) {
          console.error('Error checking face verification on app state change:', error);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      appStateSub.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} translucent={false} />
      <Slot />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <ScreenTimeProvider>
              <ThemedApp />
            </ScreenTimeProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
