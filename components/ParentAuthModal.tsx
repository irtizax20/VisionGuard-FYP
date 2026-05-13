// components/ParentAuthModal.tsx
// Secure single-device parent verification:
// - Full-screen greyed overlay (no escape)
// - Parent enters THEIR password to prove identity
// - Verified via Firebase REST API (no session switch)
// - On success: Firestore doc updated → modal closes → child continues

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { verifyParentOTP } from '../utils/ParentApproval';

interface ParentAuthModalProps {
  visible: boolean;
  parentEmail: string;       // The email the child typed — parent must match this
  verificationToken: string;
  otp: string;               // The OTP from Firestore (used to mark as approved after auth)
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ParentAuthModal({
  visible,
  parentEmail,
  verificationToken,
  otp,
  onSuccess,
  onCancel,
}: ParentAuthModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!password.trim()) {
      Alert.alert('Required', 'Please enter the parent account password.');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Verify parent credentials via Firebase REST API
      // This does NOT sign in — just verifies the password is correct.
      const apiKey = Constants.expoConfig?.extra?.firebaseApiKey || '';
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: parentEmail,
            password: password,
            returnSecureToken: false,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        const errMsg = data.error?.message || 'Invalid password';
        if (errMsg === 'EMAIL_NOT_FOUND') {
          Alert.alert('❌ Error', 'No parent account found with this email. Please register the parent account first.');
        } else if (errMsg === 'INVALID_PASSWORD' || errMsg.startsWith('INVALID_LOGIN_CREDENTIALS')) {
          Alert.alert('❌ Wrong Password', 'The password you entered is incorrect. Please try again.');
        } else if (errMsg === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
          Alert.alert('⚠️ Too Many Attempts', 'Too many failed attempts. Please wait a few minutes and try again.');
        } else {
          Alert.alert('❌ Verification Failed', errMsg);
        }
        setLoading(false);
        return;
      }

      // Step 2: Credentials verified — now approve the Firestore verification doc
      const result = await verifyParentOTP(verificationToken, otp);

      if (!result.ok) {
        Alert.alert('❌ Approval Error', result.message || 'Failed to approve registration.');
        setLoading(false);
        return;
      }

      // Success!
      setPassword('');
      setLoading(false);
      onSuccess();

    } catch (err: any) {
      console.error('ParentAuthModal error:', err);
      Alert.alert('Error', err.message || 'Verification failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      {/* Full-screen dark overlay — blocks all interaction behind it */}
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.cardWrapper}
        >
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.iconRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark" size={36} color="#27AE60" />
              </View>
            </View>

            <Text style={styles.title}>Parent Verification</Text>
            <Text style={styles.subtitle}>
              To register this child account, a parent must confirm their identity.
            </Text>

            {/* Parent email — read only */}
            <View style={styles.emailRow}>
              <Ionicons name="person-circle-outline" size={20} color="#555" />
              <Text style={styles.emailText}>{parentEmail}</Text>
              <View style={styles.emailBadge}>
                <Text style={styles.emailBadgeText}>Parent</Text>
              </View>
            </View>

            {/* Password input */}
            <Text style={styles.inputLabel}>Parent Account Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Enter parent password"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(v => !v)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color="#555"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.securityNote}>
              🔒 Your password is verified directly with Firebase and is never stored.
            </Text>

            {/* Buttons */}
            <TouchableOpacity
              style={[styles.verifyButton, loading && { opacity: 0.7 }]}
              onPress={handleVerify}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.verifyText}>Verify & Approve</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setPassword('');
                onCancel();
              }}
              disabled={loading}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 420,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#D4EDDA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
    gap: 8,
  },
  emailText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  emailBadge: {
    backgroundColor: '#27AE60',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  emailBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#DEE2E6',
    marginBottom: 12,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A2E',
  },
  eyeButton: {
    padding: 6,
  },
  securityNote: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 18,
  },
  verifyButton: {
    backgroundColor: '#27AE60',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginBottom: 10,
    elevation: 3,
  },
  verifyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#6C757D',
    fontSize: 15,
  },
});
