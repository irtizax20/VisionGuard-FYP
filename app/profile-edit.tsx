import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { EmailAuthProvider, onAuthStateChanged, reauthenticateWithCredential, updatePassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth, db } from '../firebase/firebaseConfig';
import { useTheme } from '../hooks/useTheme';
import ScreenBreakService from '../services/ScreenBreakService';


export default function ProfileEditScreen() {
  const router = useRouter();
  const { colors, fonts, spacing, borderRadius } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Advanced profile fields
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [occupation, setOccupation] = useState('');
  
  // Eye health preferences
  const [blinkReminderInterval, setBlinkReminderInterval] = useState('30'); // minutes
  const [screenBreakInterval, setScreenBreakInterval] = useState('2'); // minutes (testing)
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(true);
  const [nightModeAutoEnabled, setNightModeAutoEnabled] = useState(false);
  
  // Notification preferences
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(true);
  const [weeklyReportsEnabled, setWeeklyReportsEnabled] = useState(true);
  const [exerciseRemindersEnabled, setExerciseRemindersEnabled] = useState(true);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  
  // Original user data for comparison
  const [originalData, setOriginalData] = useState<any>(null);

  // Load user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          setEmail(user.email || '');
          
          // Try to get user data from Firestore
          const userDoc = await getDoc(doc(db, 'user', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setName(userData.name || userData.displayName || user.displayName || '');
            
            // Load advanced profile data
            setPhoneNumber(userData.phoneNumber || '');
            setDateOfBirth(userData.dateOfBirth || '');
            setGender(userData.gender || '');
            setOccupation(userData.occupation || '');
            
            // Load eye health preferences
            setBlinkReminderInterval(userData.blinkReminderInterval || '30');
            setScreenBreakInterval(userData.screenBreakInterval || '2');
            setVoiceAlertsEnabled(userData.voiceAlertsEnabled ?? true);
            setNightModeAutoEnabled(userData.nightModeAutoEnabled ?? false);
            
            // Load notification preferences
            setDailySummaryEnabled(userData.dailySummaryEnabled ?? true);
            setWeeklyReportsEnabled(userData.weeklyReportsEnabled ?? true);
            setExerciseRemindersEnabled(userData.exerciseRemindersEnabled ?? true);
            
            // Store original data for comparison
            setOriginalData({
              name: userData.name || userData.displayName || user.displayName || '',
              phoneNumber: userData.phoneNumber || '',
              dateOfBirth: userData.dateOfBirth || '',
              gender: userData.gender || '',
              occupation: userData.occupation || '',
              blinkReminderInterval: userData.blinkReminderInterval || '30',
              screenBreakInterval: userData.screenBreakInterval || '2',
              voiceAlertsEnabled: userData.voiceAlertsEnabled ?? true,
              nightModeAutoEnabled: userData.nightModeAutoEnabled ?? false,
              dailySummaryEnabled: userData.dailySummaryEnabled ?? true,
              weeklyReportsEnabled: userData.weeklyReportsEnabled ?? true,
              exerciseRemindersEnabled: userData.exerciseRemindersEnabled ?? true
            });
          } else {
            // Fallback to auth data
            setName(user.displayName || '');
            setOriginalData({
              name: user.displayName || ''
            });
          }
        } catch (error) {
          console.log('Error loading user data:', error);
          Alert.alert('Error', 'Failed to load profile data');
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Check if there are any changes
  const hasChanges = () => {
    if (!originalData) return false;
    
    return (
      name.trim() !== originalData.name ||
      phoneNumber.trim() !== (originalData.phoneNumber || '') ||
      dateOfBirth !== (originalData.dateOfBirth || '') ||
      gender !== (originalData.gender || '') ||
      occupation.trim() !== (originalData.occupation || '') ||
      blinkReminderInterval !== (originalData.blinkReminderInterval || '30') ||
      screenBreakInterval !== (originalData.screenBreakInterval || '2') ||
      voiceAlertsEnabled !== (originalData.voiceAlertsEnabled ?? true) ||
      nightModeAutoEnabled !== (originalData.nightModeAutoEnabled ?? false) ||
      dailySummaryEnabled !== (originalData.dailySummaryEnabled ?? true) ||
      weeklyReportsEnabled !== (originalData.weeklyReportsEnabled ?? true) ||
      exerciseRemindersEnabled !== (originalData.exerciseRemindersEnabled ?? true)
    );
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter your name');
      return;
    }


    // Check if there are any changes
    if (!hasChanges()) {
      Alert.alert('No Changes', 'No changes were made to your profile.');
      return;
    }


    // For minor changes, save directly
    await saveProfileChanges();
  };

  const saveProfileChanges = async (pendingChanges?: any) => {
    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');

      const dataToSave = pendingChanges || {
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
        dateOfBirth: dateOfBirth,
        gender: gender,
        occupation: occupation.trim(),
        blinkReminderInterval: blinkReminderInterval,
        screenBreakInterval: screenBreakInterval,
        voiceAlertsEnabled: voiceAlertsEnabled,
        nightModeAutoEnabled: nightModeAutoEnabled,
        dailySummaryEnabled: dailySummaryEnabled,
        weeklyReportsEnabled: weeklyReportsEnabled,
        exerciseRemindersEnabled: exerciseRemindersEnabled
      };

      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: dataToSave.name
      });

      // Update Firestore user document
      const userRef = doc(db, 'user', user.uid);
      const updateData: any = {
        name: dataToSave.name,
        phoneNumber: dataToSave.phoneNumber,
        dateOfBirth: dataToSave.dateOfBirth,
        gender: dataToSave.gender,
        occupation: dataToSave.occupation,
        blinkReminderInterval: dataToSave.blinkReminderInterval,
        screenBreakInterval: dataToSave.screenBreakInterval,
        voiceAlertsEnabled: dataToSave.voiceAlertsEnabled,
        nightModeAutoEnabled: dataToSave.nightModeAutoEnabled,
        dailySummaryEnabled: dataToSave.dailySummaryEnabled,
        weeklyReportsEnabled: dataToSave.weeklyReportsEnabled,
        exerciseRemindersEnabled: dataToSave.exerciseRemindersEnabled,
        updatedAt: new Date().toISOString(),
      };

      // Try to update existing document or create new one
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        await updateDoc(userRef, updateData);
      } else {
        await setDoc(userRef, {
          ...updateData,
          email: user.email,
          createdAt: new Date().toISOString(),
        });
      }

      // Update original data to reflect changes
      setOriginalData({
        name: dataToSave.name,
        phoneNumber: dataToSave.phoneNumber,
        dateOfBirth: dataToSave.dateOfBirth,
        gender: dataToSave.gender,
        occupation: dataToSave.occupation,
        blinkReminderInterval: dataToSave.blinkReminderInterval,
        screenBreakInterval: dataToSave.screenBreakInterval,
        voiceAlertsEnabled: dataToSave.voiceAlertsEnabled,
        nightModeAutoEnabled: dataToSave.nightModeAutoEnabled,
        dailySummaryEnabled: dataToSave.dailySummaryEnabled,
        weeklyReportsEnabled: dataToSave.weeklyReportsEnabled,
        exerciseRemindersEnabled: dataToSave.exerciseRemindersEnabled
      });

      // Update native break interval
      try {
        const intervalMinutes = parseInt(dataToSave.screenBreakInterval, 10);
        if (!isNaN(intervalMinutes) && intervalMinutes > 0) {
          await ScreenBreakService.setBreakInterval(intervalMinutes);
          console.log(`✅ Break interval updated to ${intervalMinutes} minutes`);
        }
      } catch (error) {
        console.error('❌ Failed to update break interval in native module:', error);
      }

      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };


  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Validation Error', 'Please fill all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error('No user logged in');

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);

      Alert.alert('Success', 'Password updated successfully!');
    } catch (error) {
      console.error('Error changing password:', error);
      const firebaseError = error as any;
      if (firebaseError.code === 'auth/wrong-password') {
        Alert.alert('Error', 'Current password is incorrect');
      } else if (firebaseError.code === 'auth/weak-password') {
        Alert.alert('Error', 'New password is too weak');
      } else {
        Alert.alert('Error', 'Failed to update password');
      }
    } finally {
      setSaving(false);
    }
  };

  // Create styles with theme support
  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: spacing.xxl,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.lg,
      backgroundColor: colors.background,
    },
    backButton: {
      padding: spacing.sm,
      marginRight: spacing.md,
    },
    headerTitle: {
      fontSize: fonts.xxlarge,
      fontWeight: 'bold',
      color: colors.text,
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xxl,
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
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.md,
      backgroundColor: colors.surface,
    },
    inputIcon: {
      marginRight: spacing.sm,
    },
    input: {
      flex: 1,
      fontSize: fonts.medium,
      color: colors.text,
      paddingVertical: spacing.xs,
    },
    label: {
      fontSize: fonts.medium,
      fontWeight: '500',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    primaryButtonText: {
      color: colors.background,
      fontSize: fonts.medium,
      fontWeight: '600',
      marginRight: spacing.sm,
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: fonts.medium,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: spacing.md,
      fontSize: fonts.medium,
      color: colors.textSecondary,
    },
    disabledInput: {
      opacity: 0.6,
    },
    helperText: {
      fontSize: fonts.small,
      fontStyle: 'italic',
      marginTop: -spacing.sm,
    },
    toggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
    },
    toggleActive: {
      backgroundColor: colors.primary + '10',
      borderColor: colors.primary,
    },
    toggleText: {
      flex: 1,
      fontSize: fonts.medium,
      color: colors.text,
      marginLeft: spacing.sm,
    },
    toggleTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
  }), [colors, fonts, spacing, borderRadius]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Information Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Profile Information</Text>
          </View>

          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <Text style={styles.label}>Email Address</Text>
          <View style={[styles.inputContainer, styles.disabledInput]}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              editable={false}
              placeholder="Email address"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

        </View>

        {/* Personal Information Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>

          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Enter your phone number"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
            />
          </View>

          <Text style={styles.label}>Date of Birth</Text>
          <View style={[styles.inputContainer, styles.disabledInput]}>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={dateOfBirth}
              editable={false}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          {dateOfBirth && (
            <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
              Date of birth cannot be changed after registration
            </Text>
          )}

          <Text style={styles.label}>Gender</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={gender}
              onChangeText={setGender}
              placeholder="Gender (Male/Female/Other)"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <Text style={styles.label}>Occupation</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="briefcase-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={occupation}
              onChangeText={setOccupation}
              placeholder="Your occupation"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        {/* Eye Health Preferences Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="eye-outline" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Eye Health Settings</Text>
          </View>

          <Text style={styles.label}>Blink Reminder Interval (minutes)</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="time-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={blinkReminderInterval}
              onChangeText={setBlinkReminderInterval}
              placeholder="30"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.label}>Screen Break Interval (minutes)</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="laptop-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={screenBreakInterval}
              onChangeText={setScreenBreakInterval}
              placeholder="20"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity 
            style={[styles.toggleContainer, voiceAlertsEnabled && styles.toggleActive]}
            onPress={() => setVoiceAlertsEnabled(!voiceAlertsEnabled)}
          >
            <Ionicons 
              name={voiceAlertsEnabled ? "volume-high" : "volume-mute"} 
              size={20} 
              color={voiceAlertsEnabled ? colors.primary : colors.textSecondary} 
              style={styles.inputIcon} 
            />
            <Text style={[styles.toggleText, voiceAlertsEnabled && styles.toggleTextActive]}>
              Voice Alerts Enabled
            </Text>
            <Ionicons 
              name={voiceAlertsEnabled ? "checkmark-circle" : "ellipse-outline"} 
              size={24} 
              color={voiceAlertsEnabled ? colors.primary : colors.textSecondary} 
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.toggleContainer, nightModeAutoEnabled && styles.toggleActive]}
            onPress={() => setNightModeAutoEnabled(!nightModeAutoEnabled)}
          >
            <Ionicons 
              name={nightModeAutoEnabled ? "moon" : "moon-outline"} 
              size={20} 
              color={nightModeAutoEnabled ? colors.primary : colors.textSecondary} 
              style={styles.inputIcon} 
            />
            <Text style={[styles.toggleText, nightModeAutoEnabled && styles.toggleTextActive]}>
              Auto Night Mode
            </Text>
            <Ionicons 
              name={nightModeAutoEnabled ? "checkmark-circle" : "ellipse-outline"} 
              size={24} 
              color={nightModeAutoEnabled ? colors.primary : colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>

        {/* Notification Preferences Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Notification Preferences</Text>
          </View>

          <TouchableOpacity 
            style={[styles.toggleContainer, dailySummaryEnabled && styles.toggleActive]}
            onPress={() => setDailySummaryEnabled(!dailySummaryEnabled)}
          >
            <Ionicons 
              name="today-outline" 
              size={20} 
              color={dailySummaryEnabled ? colors.primary : colors.textSecondary} 
              style={styles.inputIcon} 
            />
            <Text style={[styles.toggleText, dailySummaryEnabled && styles.toggleTextActive]}>
              Daily Summary Reports
            </Text>
            <Ionicons 
              name={dailySummaryEnabled ? "checkmark-circle" : "ellipse-outline"} 
              size={24} 
              color={dailySummaryEnabled ? colors.primary : colors.textSecondary} 
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.toggleContainer, weeklyReportsEnabled && styles.toggleActive]}
            onPress={() => setWeeklyReportsEnabled(!weeklyReportsEnabled)}
          >
            <Ionicons 
              name="calendar-outline" 
              size={20} 
              color={weeklyReportsEnabled ? colors.primary : colors.textSecondary} 
              style={styles.inputIcon} 
            />
            <Text style={[styles.toggleText, weeklyReportsEnabled && styles.toggleTextActive]}>
              Weekly Progress Reports
            </Text>
            <Ionicons 
              name={weeklyReportsEnabled ? "checkmark-circle" : "ellipse-outline"} 
              size={24} 
              color={weeklyReportsEnabled ? colors.primary : colors.textSecondary} 
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.toggleContainer, exerciseRemindersEnabled && styles.toggleActive]}
            onPress={() => setExerciseRemindersEnabled(!exerciseRemindersEnabled)}
          >
            <Ionicons 
              name="fitness-outline" 
              size={20} 
              color={exerciseRemindersEnabled ? colors.primary : colors.textSecondary} 
              style={styles.inputIcon} 
            />
            <Text style={[styles.toggleText, exerciseRemindersEnabled && styles.toggleTextActive]}>
              Exercise Reminders
            </Text>
            <Ionicons 
              name={exerciseRemindersEnabled ? "checkmark-circle" : "ellipse-outline"} 
              size={24} 
              color={exerciseRemindersEnabled ? colors.primary : colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>

        {/* Password Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Security</Text>
          </View>

          {!showPasswordSection ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setShowPasswordSection(true)}
            >
              <Text style={styles.secondaryButtonText}>Change Password</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={styles.label}>Current Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />
              </View>

              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />
              </View>

              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleChangePassword}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Update Password</Text>
                    <Ionicons name="checkmark" size={20} color={colors.background} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setShowPasswordSection(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Save Profile Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSaveProfile}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Save Profile</Text>
              <Ionicons name="checkmark" size={20} color={colors.background} />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
