import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { Alert, BackHandler, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LogoutButton from '../../components/ui/LogoutButton';
import { auth } from '../../firebase/firebaseConfig';
import { useThemeContext } from '../../hooks/ThemeContext';
import { useTheme } from '../../hooks/useTheme';
import NativeScreenTrackingService from '../../services/NativeScreenTrackingService';
import ScreenTimeSyncService from '../../services/ScreenTimeSyncService';
import TTSSettingsService from '../../services/TTSSettingsService';
import VisionGuardOverlayService from '../../services/VisionGuardOverlayService';

// Settings Screen Component
export default function SettingsScreen() {
  const nav = useNavigation();
  const { colors, fonts, spacing, borderRadius, scaleFontSize } = useTheme();
  const { settings, updateSetting, resetToDefaults } = useThemeContext();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [ttsLanguage, setTtsLanguage] = useState<'english' | 'urdu'>('english');
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitPassword, setExitPassword] = useState('');
  const [isExiting, setIsExiting] = useState(false);

  React.useLayoutEffect(() => {
    nav.setOptions({ headerRight: () => <LogoutButton /> });
  }, [nav]);

  // Load TTS language preference on mount
  useEffect(() => {
    loadTTSLanguage();
  }, []);

  const loadTTSLanguage = async () => {
    try {
      const language = await TTSSettingsService.getLanguagePreference();
      setTtsLanguage(language);
    } catch (error) {
      console.error('Error loading TTS language:', error);
    }
  };

  const handleLanguageChange = async (language: 'english' | 'urdu') => {
    try {
      await TTSSettingsService.setLanguagePreference(language);
      setTtsLanguage(language);
      Alert.alert(
        'Language Updated',
        `Voice alerts will now be in ${language === 'urdu' ? 'Urdu (اردو)' : 'English'}.`
      );
    } catch (error) {
      console.error('Error setting TTS language:', error);
      Alert.alert('Error', 'Failed to update language preference.');
    }
  };

  const handleTestVoice = async () => {
    if (isTestingVoice) return;
    
    setIsTestingVoice(true);
    try {
      await TTSSettingsService.testVoice(ttsLanguage);
      // Success - voice is playing
    } catch (error: any) {
      Alert.alert(
        'Voice Not Available',
        error.message || 'Unable to play test voice. Please check your device TTS settings.',
        [
          {
            text: 'OK',
            style: 'default'
          }
        ]
      );
    } finally {
      // Reset after 3 seconds
      setTimeout(() => setIsTestingVoice(false), 3000);
    }
  };



  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetToDefaults();
            Alert.alert('Success', 'Settings have been reset to defaults.');
          }
        }
      ]
    );
  };

  const handleSecureExit = async () => {
    if (!exitPassword) {
      Alert.alert("Error", "Please enter your password.");
      return;
    }
    
    setIsExiting(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error("User not found");
      }
      
      const credential = EmailAuthProvider.credential(user.email, exitPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Stop all background services securely
      try {
        await NativeScreenTrackingService.stopTracking();
        await VisionGuardOverlayService.stopOverlayService();
        ScreenTimeSyncService.cleanup();
      } catch (e) {
        console.warn("Error stopping background services:", e);
      }
      
      setShowExitModal(false);
      setExitPassword('');
      setIsExiting(false);
      
      Alert.alert(
        "Services Stopped", 
        "Vision Guard monitoring has been securely stopped.",
        [{ text: "Exit App", onPress: () => BackHandler.exitApp() }]
      );
      
    } catch (error: any) {
      setIsExiting(false);
      Alert.alert("Authentication Failed", "Incorrect password. The app will continue monitoring.");
    }
  };

  // Create styles inside component to make them reactive to theme changes
  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.md,
    },
    header: {
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      alignItems: 'center',
    },
    title: {
      fontSize: fonts.xxlarge,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: fonts.medium,
      color: colors.textSecondary,
    },
    logoutButton: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    section: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    sectionTitle: {
      fontSize: fonts.large,
      fontWeight: '600',
      color: colors.text,
      marginLeft: spacing.sm,
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    lastSettingItem: {
      borderBottomWidth: 0,
    },
    settingLabel: {
      fontSize: fonts.medium,
      color: colors.text,
      flex: 1,
    },
    settingDescription: {
      fontSize: fonts.small,
      color: colors.textSecondary,
      marginTop: spacing.xs,
    },
    pickerContainer: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.surface,
      minWidth: 120,
    },
    picker: {
      color: colors.text,
    },
    switchContainer: {
      marginLeft: spacing.sm,
    },
    resetButton: {
      backgroundColor: colors.error,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      alignItems: 'center',
      marginVertical: spacing.lg,
    },
    resetButtonText: {
      color: '#FFFFFF',
      fontSize: fonts.medium,
      fontWeight: '600',
    },
    previewText: {
      fontSize: fonts.medium,
      color: colors.text,
      textAlign: 'center',
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.sm,
      marginTop: spacing.sm,
    },
    buttonGroup: {
      flexDirection: 'row',
      marginBottom: spacing.md,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    activeButton: {
      backgroundColor: colors.primary,
    },
    optionButtonText: {
      fontSize: fonts.small,
      color: colors.text,
      marginLeft: spacing.xs,
      fontWeight: '500',
    },
    activeButtonText: {
      color: colors.background,
      fontWeight: '600',
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      width: '100%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: fonts.xlarge,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      fontSize: fonts.medium,
      color: colors.text,
      marginBottom: spacing.lg,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.md,
    },
    modalButton: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
    },
  }), [colors, fonts, spacing, borderRadius]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Customize your Vision Guard experience</Text>
      </View>


      {/* Profile Settings */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person-outline" size={24} color={colors.primary} />
          <Text style={styles.sectionTitle}>Profile</Text>
        </View>

        <TouchableOpacity
          style={[styles.settingItem, styles.lastSettingItem]}
          onPress={() => router.push('/profile-edit')}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Edit Profile</Text>
            <Text style={styles.settingDescription}>Update your personal information and password</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Theme Settings */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="color-palette-outline" size={24} color={colors.primary} />
          <Text style={styles.sectionTitle}>Appearance</Text>
        </View>

        <View style={styles.settingItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Theme</Text>
            <Text style={styles.settingDescription}>Choose your preferred theme</Text>
          </View>
        </View>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.optionButton, settings.themeMode === 'auto' && styles.activeButton]}
            onPress={() => updateSetting('themeMode', 'auto')}
          >
            <Ionicons name="phone-portrait-outline" size={16} color={settings.themeMode === 'auto' ? colors.background : colors.text} />
            <Text style={[styles.optionButtonText, settings.themeMode === 'auto' && styles.activeButtonText]}>Auto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, settings.themeMode === 'light' && styles.activeButton]}
            onPress={() => updateSetting('themeMode', 'light')}
          >
            <Ionicons name="sunny-outline" size={16} color={settings.themeMode === 'light' ? colors.background : colors.text} />
            <Text style={[styles.optionButtonText, settings.themeMode === 'light' && styles.activeButtonText]}>Light</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, settings.themeMode === 'dark' && styles.activeButton]}
            onPress={() => updateSetting('themeMode', 'dark')}
          >
            <Ionicons name="moon-outline" size={16} color={settings.themeMode === 'dark' ? colors.background : colors.text} />
            <Text style={[styles.optionButtonText, settings.themeMode === 'dark' && styles.activeButtonText]}>Dark</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.settingItem, styles.lastSettingItem]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>High Contrast</Text>
            <Text style={styles.settingDescription}>Increase contrast for better visibility</Text>
          </View>
        </View>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.optionButton, !settings.highContrast && styles.activeButton]}
            onPress={() => updateSetting('highContrast', false)}
          >
            <Ionicons name="contrast-outline" size={16} color={!settings.highContrast ? colors.background : colors.text} />
            <Text style={[styles.optionButtonText, !settings.highContrast && styles.activeButtonText]}>Normal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, settings.highContrast && styles.activeButton]}
            onPress={() => updateSetting('highContrast', true)}
          >
            <Ionicons name="contrast" size={16} color={settings.highContrast ? colors.background : colors.text} />
            <Text style={[styles.optionButtonText, settings.highContrast && styles.activeButtonText]}>High Contrast</Text>
          </TouchableOpacity>
        </View>
      </View>


      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="accessibility-outline" size={24} color={colors.primary} />
          <Text style={styles.sectionTitle}>Accessibility</Text>
        </View>

        <View style={styles.settingItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Font Size</Text>
            <Text style={styles.settingDescription}>Adjust text size for better readability</Text>
          </View>
        </View>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.optionButton, settings.fontSize === 'small' && styles.activeButton]}
            onPress={() => updateSetting('fontSize', 'small')}
          >
            <Ionicons name="text-outline" size={12} color={settings.fontSize === 'small' ? colors.background : colors.text} />
            <Text style={[styles.optionButtonText, settings.fontSize === 'small' && styles.activeButtonText, { fontSize: scaleFontSize(12) }]}>Small</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, settings.fontSize === 'medium' && styles.activeButton]}
            onPress={() => updateSetting('fontSize', 'medium')}
          >
            <Ionicons name="text-outline" size={16} color={settings.fontSize === 'medium' ? colors.background : colors.text} />
            <Text style={[styles.optionButtonText, settings.fontSize === 'medium' && styles.activeButtonText, { fontSize: scaleFontSize(14) }]}>Medium</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, settings.fontSize === 'large' && styles.activeButton]}
            onPress={() => updateSetting('fontSize', 'large')}
          >
            <Ionicons name="text-outline" size={20} color={settings.fontSize === 'large' ? colors.background : colors.text} />
            <Text style={[styles.optionButtonText, settings.fontSize === 'large' && styles.activeButtonText, { fontSize: scaleFontSize(16) }]}>Large</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.previewText, { fontSize: scaleFontSize(16) }]}>
          Preview: This is how text will appear with your selected font size.
        </Text>
        <Text style={[styles.settingDescription, { fontSize: scaleFontSize(12) }]}>
          Current: {settings.fontSize} (multiplier: {Math.round(scaleFontSize(16) / 16 * 100)}%)
        </Text>

        <View style={styles.settingItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Sound Effects</Text>
            <Text style={styles.settingDescription}>Enable app sounds and notifications</Text>
          </View>
          <View style={styles.switchContainer}>
            <Switch
              value={settings.soundEnabled}
              onValueChange={(value) => updateSetting('soundEnabled', value)}
              trackColor={{ false: colors.border, true: colors.secondary }}
              thumbColor={colors.card}
            />
          </View>
        </View>

        <View style={[styles.settingItem, styles.lastSettingItem]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Voice Alerts</Text>
            <Text style={styles.settingDescription}>Enable voice notifications for eye care reminders</Text>
          </View>
          <View style={styles.switchContainer}>
            <Switch
              value={settings.voiceAlertsEnabled}
              onValueChange={(value) => updateSetting('voiceAlertsEnabled', value)}
              trackColor={{ false: colors.border, true: colors.secondary }}
              thumbColor={colors.card}
            />
          </View>
        </View>
      </View>

      {/* Voice Settings */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="volume-high-outline" size={24} color={colors.primary} />
          <Text style={styles.sectionTitle}>Voice Settings</Text>
        </View>

        <View style={styles.settingItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Voice Language</Text>
            <Text style={styles.settingDescription}>Choose language for voice alerts</Text>
          </View>
        </View>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.optionButton, ttsLanguage === 'english' && styles.activeButton]}
            onPress={() => handleLanguageChange('english')}
          >
            <Ionicons 
              name="flag-outline" 
              size={16} 
              color={ttsLanguage === 'english' ? colors.background : colors.text} 
            />
            <Text style={[styles.optionButtonText, ttsLanguage === 'english' && styles.activeButtonText]}>
              English
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, ttsLanguage === 'urdu' && styles.activeButton]}
            onPress={() => handleLanguageChange('urdu')}
          >
            <Ionicons 
              name="flag-outline" 
              size={16} 
              color={ttsLanguage === 'urdu' ? colors.background : colors.text} 
            />
            <Text style={[styles.optionButtonText, ttsLanguage === 'urdu' && styles.activeButtonText]}>
              Urdu (اردو)
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.settingItem, 
            styles.lastSettingItem,
            { 
              backgroundColor: colors.surface, 
              borderRadius: borderRadius.sm,
              marginTop: spacing.sm,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.md
            }
          ]}
          onPress={handleTestVoice}
          disabled={isTestingVoice}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons 
                name={isTestingVoice ? "volume-high" : "play-circle-outline"} 
                size={24} 
                color={colors.primary} 
              />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[styles.settingLabel, { fontWeight: '600' }]}>
                {isTestingVoice ? 'Playing...' : 'Test Voice'}
              </Text>
              <Text style={styles.settingDescription}>
                {ttsLanguage === 'urdu' 
                  ? 'آواز کی جانچ کریں (Test in Urdu)'
                  : 'Hear a sample voice alert'}
              </Text>
            </View>
          </View>
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>


      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="help-circle-outline" size={24} color={colors.primary} />
          <Text style={styles.sectionTitle}>Support & Help</Text>
        </View>

        <TouchableOpacity
          style={[styles.settingItem, styles.lastSettingItem]}
          onPress={() => router.push('../SupportSystem')}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Help Center</Text>
            <Text style={styles.settingDescription}>FAQs, guides, and contact support</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>


      <TouchableOpacity style={styles.resetButton} onPress={handleResetSettings}>
        <Text style={styles.resetButtonText}>Reset All Settings</Text>
      </TouchableOpacity>
      
      {/* Background Monitoring Toggle for testing/convenience */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
          <Text style={styles.sectionTitle}>Vision Guard Service</Text>
        </View>
        <TouchableOpacity
          style={[styles.settingItem, styles.lastSettingItem]}
          onPress={async () => {
             try {
                await VisionGuardOverlayService.startOverlayService();
                Alert.alert("Success", "Background monitoring started");
             } catch (e: any) {
                Alert.alert("Error", e.message || "Failed to start service");
             }
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Start Background Overlay</Text>
            <Text style={styles.settingDescription}>Enable floating icon monitoring</Text>
          </View>
          <Ionicons name="play" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.resetButton, { backgroundColor: '#FF3B30', marginTop: 10 }]}
        activeOpacity={0.8}
        onPress={() => { setShowExitModal(true); setExitPassword(''); }}
      >
        <Text style={[styles.resetButtonText, { color: '#FFFFFF' }]}>Secure Close App</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.resetButton, { backgroundColor: colors.primary }]}
        activeOpacity={0.8}
        onPress={() => {
          Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Logout',
              style: 'destructive',
              onPress: async () => {
                try {
                  console.log('🚪 Starting logout process from Settings...');
                  
                  // Force sync screen time to Firestore before logout
                  try {
                    await ScreenTimeSyncService.forceSync();
                    console.log('✅ Screen time synced to Firestore');
                  } catch (syncError) {
                    console.warn('⚠️ Failed to sync screen time before logout:', syncError);
                  }
                  
                  // Stop all services after sync
                  try {
                    // Stop screen time tracking
                    await NativeScreenTrackingService.stopTracking();
                    console.log('✅ Screen Time Tracking stopped');
                    
                    // Cleanup screen time sync service
                    ScreenTimeSyncService.cleanup();
                    console.log('✅ Screen Time Sync Service cleaned up');
                  } catch (serviceError) {
                    console.warn('⚠️ Error stopping services:', serviceError);
                  }
                  
                  // Perform Firebase logout
                  await signOut(auth);
                  console.log('✅ Firebase sign out successful');
                  
                  Alert.alert('Success', 'You have been logged out successfully. All services stopped.');
                  router.replace('/(auth)/Login');
                } catch (error) {
                  console.error('❌ Logout failed:', error);
                  Alert.alert('Error', 'Failed to logout. Please try again.');
                }
              },
            },
          ]);
        }}
      >
        <Text style={[styles.resetButtonText, { color: colors.background }]}>Logout</Text>
      </TouchableOpacity>
      <Modal visible={showExitModal} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Secure Close</Text>
            <Text style={[styles.settingDescription, { marginBottom: 20, textAlign: 'center' }]}>
              Please enter your account password to securely stop monitoring and exit.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={exitPassword}
              onChangeText={setExitPassword}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: colors.surface }]}
                onPress={() => setShowExitModal(false)}
                disabled={isExiting}
              >
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: '#FF3B30' }]}
                onPress={handleSecureExit}
                disabled={isExiting}
              >
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
                  {isExiting ? "Verifying..." : "Stop & Exit"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

