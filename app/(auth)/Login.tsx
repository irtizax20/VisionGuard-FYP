import React, { useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../../firebase/firebaseConfig';
import Logger from '../../utils/logger';
import { createSecureErrorMessage, isStrongPassword, loginRateLimiter, sanitizeInput, validateEmail } from '../../utils/securityUtils';

const { width, height } = Dimensions.get('window');


export default function AuthScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkPasswordStrength = (pw: string) => isStrongPassword(pw);

  // Validate Gmail address
  const validateGmailAddress = (emailAddress: string): { valid: boolean; error?: string } => {
    const trimmedEmail = emailAddress.trim().toLowerCase();
    
    // Check if it's a Gmail address
    if (!trimmedEmail.endsWith('@gmail.com')) {
      return { valid: false, error: 'Only Gmail addresses are allowed. Please use your Gmail account.' };
    }
    
    return { valid: true };
  };

  // Find user profile in user collection
  const findUserProfile = async (uid: string, userEmail: string) => {
    const emailLower = (userEmail || '').toLowerCase();

    // Try by document id (uid)
    try {
      const ref = doc(db, 'user', uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data: any = snap.data();
        return { found: true as const, data };
      }
    } catch (error) {
      console.error('Error fetching user by uid:', error);
    }

    // Fallback: try by emailLower
    if (emailLower) {
      try {
        const q = query(collection(db, 'user'), where('emailLower', '==', emailLower));
        const qs = await getDocs(q);
        if (!qs.empty) {
          const data: any = qs.docs[0].data();
          return { found: true as const, data };
        }
      } catch (error) {
        console.error('Error fetching user by email:', error);
      }
    }

    return { found: false as const };
  };

  const handleLogin = async () => {
    setErrorMessage(null); // Clear previous errors
    // Sanitize inputs
    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    const sanitizedPassword = password; // Don't sanitize password

    // Validate inputs
    if (!sanitizedEmail.trim() || !sanitizedPassword.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    // Validate email format
    if (!validateEmail(sanitizedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    // Validate Gmail address
    const gmailValidation = validateGmailAddress(sanitizedEmail);
    if (!gmailValidation.valid) {
      setErrorMessage(gmailValidation.error || 'Invalid Gmail address.');
      return;
    }

    // Check rate limiting
    if (!loginRateLimiter.isAllowed(sanitizedEmail)) {
      const timeRemaining = loginRateLimiter.getTimeUntilReset(sanitizedEmail);
      Logger.warn(`Login rate limit exceeded for ${sanitizedEmail}`, 'Login');
      setErrorMessage(`Too many attempts. Please wait ${timeRemaining} seconds before trying again.`);
      return;
    }

    setIsLoading(true);
    try {
      Logger.info('Login attempt started', 'Login', { email: sanitizedEmail });

      const userCredential = await signInWithEmailAndPassword(auth, sanitizedEmail, sanitizedPassword);
      const user = userCredential.user;

      if (!user.emailVerified) {
        Logger.warn('Email not verified', 'Login', { email: sanitizedEmail });
        
        try {
          const { sendEmailVerification } = require('firebase/auth');
          await sendEmailVerification(user);
          setErrorMessage('Your email is not verified. We just sent a fresh verification link to your inbox. Please check your spam folder too.');
        } catch (e) {
          setErrorMessage('Your email is not verified. Please verify your email first to continue.');
        }
        
        // Sign out user if email not verified
        await auth.signOut();
        return;
      }

      // Check profile existence in user collection
      const profile = await findUserProfile(user.uid, user.email || sanitizedEmail);
      if (!profile.found) {
        Logger.error('Profile not found after login', 'Login', { uid: user.uid });
        setErrorMessage('Your account profile could not be found. Please contact support.');
        await auth.signOut();
        return;
      }

      // Reset rate limiter on successful login
      loginRateLimiter.reset(sanitizedEmail);
      Logger.info('Login successful', 'Login', { email: sanitizedEmail, category: profile.data?.category });

      // IMPORTANT: Always require face verification after login for security
      // Clear any previous face verification status to force re-verification
      try {
        await AsyncStorage.removeItem('faceVerificationCompleted');
        console.log('🔄 Cleared previous face verification - requiring fresh verification');
      } catch (error) {
        console.warn('⚠️ Failed to clear face verification status:', error);
      }

      // Navigate to face verification FIRST (mandatory after login)
      // Screen time will be fetched AFTER face verification is complete
      console.log('🔐 Face verification required - navigating to face verification screen');
      router.replace('../(auth)/face-verification');

    } catch (error) {
      Logger.error('Login failed', 'Login', error);

      // Use secure error messages that don't leak information
      const userMessage = createSecureErrorMessage(error, 'Login');
      setErrorMessage(userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#FAFAFA' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          style={{ backgroundColor: '#FAFAFA' }}
        >
          <View style={styles.container}>
            {/* Header Section */}
            <View style={styles.headerSection}>
              <View style={styles.logoContainer}>
                <View style={styles.logoCircle}>
                  <Image
                    source={require('../../assets/logo.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
              </View>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to track your fitness with Vision Guard</Text>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#2B383D" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#8A9BA8"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  value={email}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#2B383D" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#8A9BA8"
                  secureTextEntry={!showPassword}
                  onChangeText={setPassword}
                  value={password}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color="#8A9BA8"
                  />
                </TouchableOpacity>
              </View>
              {password.length > 0 && !checkPasswordStrength(password) && (
                <Text style={styles.passwordHint}>
                  Password should include uppercase, lowercase, a number, and a special character (min 8 chars).
                </Text>
              )}

              {/* Error Message Display */}
              {errorMessage && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={20} color="#F44336" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.disabledButton]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#FAFAFA" />
                    <Text style={[styles.primaryButtonText, { marginLeft: 8 }]}>Signing in...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Login</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FAFAFA" style={styles.buttonIcon} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => router.push('/forgetPassword')}
              >
                <Text style={styles.forgotText}>Forgot your password?</Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.socialSection}>
              <View style={styles.signupContainer}>
                <Text style={styles.signupText}>Don&apos;t have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/signup')}>
                  <Text style={styles.signupLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    paddingHorizontal: width * 0.06,
    paddingBottom: height * 0.05,
    paddingTop: height * 0.02,
  },

  // Header Section
  headerSection: {
    alignItems: 'center',
    marginBottom: height * 0.05,
    marginTop: height * 0.12,
  },
  logoContainer: {
    marginBottom: 30,
  },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#2B383D',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    overflow: 'hidden',
  },
  logoImage: {
    width: 85,
    height: 85,
    borderRadius: 42.5,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2B383D',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    color: '#2B383D',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 4,
  },

  // Form Section
  formSection: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#DADCE0',
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inputIcon: {
    marginRight: 12,
    color: '#2B383D',
  },
  eyeIcon: {
    padding: 8,
    marginLeft: 4,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#2B383D',
    fontWeight: '400',
  },
  passwordHint: {
    fontSize: 12,
    color: '#D9534F',
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 8,
    marginRight: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2B383D',
    borderRadius: 24,
    paddingVertical: 16,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  disabledButton: {
    backgroundColor: '#8A9BA8',
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  forgotButton: {
    alignSelf: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  forgotText: {
    fontSize: 14,
    color: '#2B383D',
    fontWeight: '500',
  },

  // Footer
  socialSection: {
    width: '100%',
    marginTop: height * 0.04,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 14,
    color: '#8A9BA8',
  },
  signupLink: {
    fontSize: 14,
    color: '#2B383D',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
});
