import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../../firebase/firebaseConfig';
import { useTheme } from '../../hooks/useTheme';
// DON'T import BackgroundSyncManager statically - load conditionally
// import BackgroundSyncManager from '../../services/BackgroundSyncManager';
import BrightnessService from '../../services/BrightnessService';
import CategoryManager from '../../services/CategoryManager';
import DailySummaryService from '../../services/DailySummaryService';
import EyeImageCaptureService from '../../services/EyeImageCaptureService';
import NativeScreenTrackingService from '../../services/NativeScreenTrackingService';
import OfflineSyncService from '../../services/OfflineSyncService';
import ScreenTimeSyncService from '../../services/ScreenTimeSyncService';
import SecureStorageService from '../../services/SecureStorageService';
import ServiceInitializer from '../../services/ServiceInitializer';

export default function LogoutButton() {
  const [modalVisible, setModalVisible] = useState(false);
  const { colors, fonts } = useTheme();
// Handle user logout
  const handleLogout = async () => {
    setModalVisible(false);
    
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🚪 Starting logout process...');
              
              // Force sync ALL data to Firestore before logout
              try {
                console.log('📤 Syncing all data to Firestore...');
                
                // Sync screen time
                await ScreenTimeSyncService.forceSync();
                console.log('✅ Screen time synced to Firestore');
                
                // Sync blink data (if any pending)
                try {
                  const BlinkTrackingService = (await import('../../services/BlinkTrackingService')).default;
                  // Blink data is saved immediately, but ensure latest is synced
                  console.log('✅ Blink data already synced (saved immediately)');
                } catch (blinkError) {
                  console.warn('⚠️ Failed to verify blink data sync:', blinkError);
                }
              } catch (syncError) {
                console.warn('⚠️ Failed to sync data before logout:', syncError);
                // Continue with logout even if sync fails
              }
              
              // Stop and cleanup ALL services after sync
              try {
                console.log('🛑 Stopping all services...');
                
                // 1. Stop screen time tracking
                await NativeScreenTrackingService.stopTracking();
                console.log('✅ Screen Time Tracking stopped');
                
                // 2. Cleanup screen time sync service
                ScreenTimeSyncService.cleanup();
                console.log('✅ Screen Time Sync Service cleaned up');
                
                // 3. Cleanup background sync manager (skip on Android 13+)
                try {
                  const { Platform } = require('react-native');
                  if (Platform.OS !== 'android' || Platform.Version < 33) {
                    const BackgroundSyncManager = require('../../services/BackgroundSyncManager').default;
                    const syncManager = BackgroundSyncManager.getInstance();
                    await syncManager.cleanup();
                    console.log('✅ Background Sync Manager cleaned up');
                  } else {
                    console.log('⏭️ Skipping Background Sync cleanup (Android 13+)');
                  }
                } catch (syncCleanupError) {
                  console.warn('⚠️ Background Sync cleanup skipped:', syncCleanupError);
                }
                
                // 4. Cleanup brightness service
                const brightnessService = BrightnessService.getInstance();
                await brightnessService.cleanup();
                console.log('✅ Brightness Service cleaned up');
                
                // 5. Reset service initializer state
                const serviceInitializer = ServiceInitializer.getInstance();
                serviceInitializer.reset();
                console.log('✅ Service Initializer reset');
                
                console.log('✅ All services stopped and cleaned up');
              } catch (serviceError) {
                console.warn('⚠️ Error stopping services:', serviceError);
                // Continue with logout even if cleanup fails
              }

              // Clear ALL AsyncStorage data before logout
              try {
                console.log('🗑️ Clearing all user data from AsyncStorage...');
                
                // Clear offline sync data (queue, conflicts, cached docs)
                await OfflineSyncService.clearAllData();
                console.log('✅ Offline sync data cleared');
                
                // Clear user category
                await CategoryManager.clearAllData();
                console.log('✅ User category cleared');
                
                // Clear daily summary data (metrics, notifications)
                await DailySummaryService.clearAllData();
                console.log('✅ Daily summary data cleared');
                
                // Clear secure storage (biometric settings, auto-login)
                await SecureStorageService.clearAllData();
                console.log('✅ Secure storage cleared');
                
                // Clear eye image data (metadata + files)
                await EyeImageCaptureService.clearAllData();
                console.log('✅ Eye image data cleared');
                
                // Note: ScreenTimeContext.clearLocalData() will be called by context when auth state changes
                
                console.log('✅ All user data cleared from device');
              } catch (clearError) {
                console.warn('⚠️ Error clearing user data:', clearError);
                // Continue with logout even if cleanup fails
              }
              
              // Perform Firebase logout
              await signOut(auth);
              console.log('✅ Firebase sign out successful');
              
              Alert.alert('Success', 'You have been logged out successfully. All data cleared.');
              router.replace('/(auth)/Login');
            } catch (error) {
              console.error('❌ Logout failed:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const styles = React.useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.1)',
      paddingTop: 40,
      paddingRight: 15,
    },
    modalContent: {
      backgroundColor: colors.card,
      borderRadius: 8,
      paddingVertical: 15,
      paddingHorizontal: 30,
      elevation: 5,
      shadowColor: colors.shadow,
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    logoutText: {
      color: colors.error,
      fontSize: fonts.medium,
      fontWeight: '600',
    },
  }), [colors, fonts]);

  return (
    <View style={{ marginRight: 16 }}>
      <TouchableOpacity onPress={() => setModalVisible(true)}>
        <Ionicons name="person-circle-outline" size={30} color={colors.text} />
      </TouchableOpacity>

      <Modal
        transparent
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent}>
            <TouchableOpacity onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
