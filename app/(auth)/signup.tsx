import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth, db } from '../../firebase/firebaseConfig';
import { setDoc } from 'firebase/firestore';
// import { validateParentEmail } from '../../utils/ParentVerification';
import { DateOfBirthPicker } from '../../components/ui/DateOfBirthPicker';
// Sign Up Screen Component
const { width, height } = Dimensions.get('window');



export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [category, setCategory] = useState('adult');
  const [parentEmail, setParentEmail] = useState('');
  
  // Parent verification states
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'sending' | 'pending' | 'verified'>('none');
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parentOtpInput, setParentOtpInput] = useState('');
  const [generatedOtpCode, setGeneratedOtpCode] = useState<string | null>(null); // stored for single-phone demo
  
  const router = useRouter();

  // Enable parent approval flow for child signups
  const PARENT_APPROVAL_ENABLED = true;

  // Real-time listener for parent verification status
  useEffect(() => {
    if (!verificationToken || !isListening) return;

    console.log('👂 Starting real-time listener for verification token:', verificationToken);
    
    const unsubscribe = onSnapshot(
      doc(db, 'parent_verifications', verificationToken),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('📡 Verification status update:', data.status);
          
          if (data.status === 'verified') {
            setVerificationStatus('verified');
            setIsListening(false);
            Alert.alert(
              '✅ Parent Verified!',
              'Your parent has approved your registration. You can now continue to face registration.',
              [{ text: 'Great!' }]
            );
          } else if (data.status === 'expired') {
            setVerificationStatus('none');
            setIsListening(false);
            Alert.alert(
              '⏰ Verification Expired',
              'The verification link has expired. Please send a new verification request.',
              [{ text: 'OK' }]
            );
          }
        }
      },
      (error) => {
        console.error('❌ Firestore listener error:', error);
        setIsListening(false);
      }
    );

    return () => {
      console.log('🛑 Cleaning up verification listener');
      unsubscribe();
    };
  }, [verificationToken, isListening]);

  // Calculate age from date of birth
  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Validate Gmail address
  const validateGmailAddress = (emailAddress: string): { valid: boolean; error?: string } => {
    const trimmedEmail = emailAddress.trim().toLowerCase();
    
    // Check if it's a Gmail address
    if (!trimmedEmail.endsWith('@gmail.com')) {
      return { valid: false, error: 'Only Gmail addresses are allowed. Please use your Gmail account.' };
    }
    
    return { valid: true };
  };

  // Auto-set category based on age (child <16, adult 16-40, old >40)
  const handleDateOfBirthChange = (date: string) => {
    setDateOfBirth(date);
    if (date) {
      const age = calculateAge(date);
      if (age < 16) {
        setCategory('child');
      } else if (age >= 16 && age <= 40) {
        setCategory('adult');
      } else {
        setCategory('old');
      }
    }
  };

  const isStrongPassword = (pw: string) => {
    // Must contain: lowercase, uppercase, digit, special character; 6-15 chars
    const hasLowercase = /[a-z]/.test(pw);
    const hasUppercase = /[A-Z]/.test(pw);
    const hasNumber = /\d/.test(pw);
    const hasSpecial = /[^A-Za-z0-9]/.test(pw);
    const isValidLength = pw.length >= 6 && pw.length <= 15;
    
    return hasLowercase && hasUppercase && hasNumber && hasSpecial && isValidLength;
  };

  // Handle Send Verification button
  const handleSendVerification = async () => {
    try {
      // Validate all required fields first
      if (!name || !email || !password || !confirmPassword || !dateOfBirth) {
        Alert.alert('Missing Information', 'Please fill all required fields before verifying parent email.');
        return;
      }

      // Block under-5 users
      const userAge = calculateAge(dateOfBirth);
      if (userAge < 5) {
        Alert.alert('Age Restriction', 'Users must be at least 5 years old to sign up.');
        return;
      }

      // Validate Gmail
      const gmailValidation = validateGmailAddress(email);
      if (!gmailValidation.valid) {
        Alert.alert('Invalid Email', gmailValidation.error || 'Please enter a valid Gmail address.');
        return;
      }

      // Validate password match
      if (password !== confirmPassword) {
        Alert.alert('Password Mismatch', 'Passwords do not match.');
        return;
      }

      // Validate password strength
      if (!isStrongPassword(password)) {
        Alert.alert(
          'Weak Password',
          'Password must include:\n• 1 uppercase letter\n• 1 lowercase letter\n• 1 number\n• 1 special character\n• Length between 6-15 characters'
        );
        return;
      }

      if (!parentEmail) {
        Alert.alert('Missing Info', 'Please enter your parent\'s email address.');
        return;
      }

      setVerificationStatus('sending');

      // Import UserManagementService
      const { UserManagementService } = await import('../../services/UserManagementService');
      
      // Validate parent email exists and child limit not exceeded
      console.log('🔍 Validating parent email...');
      const validation = await UserManagementService.validateChildSignup(parentEmail);
      
      if (!validation.isValid) {
        setVerificationStatus('none');
        Alert.alert('Parent Validation Failed', validation.error || 'Unable to validate parent information.');
        return;
      }
      
      console.log('✅ Parent validation successful, sending verification email...');

      const { requestParentApproval } = await import('../../utils/ParentApproval');
      const approvalRes = await requestParentApproval({
        name,
        email,
        password,
        dateOfBirth,
        category,
        parentEmail,
      });

      if (!approvalRes.ok || !approvalRes.token) {
        setVerificationStatus('none');
        Alert.alert('Verification Error', approvalRes.message || 'Failed to send verification email.');
        return;
      }

      setVerificationToken(approvalRes.token!);
      setGeneratedOtpCode(approvalRes.message || null); // store OTP for single-device access
      setVerificationStatus('pending');

      Alert.alert(
        '📱 Ask Your Parent',
        `A 6-digit verification code has been prepared for ${parentEmail}.\n\nAsk your parent to:\n1. Open VisionGuard app → Parent Dashboard\n2. See the yellow code card and tell you the code\n\n💡 Only one phone? Tap "Show Code" below to see it directly.`,
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      console.error('❌ Verification error:', error);
      setVerificationStatus('none');
      Alert.alert('Error', error.message || 'Failed to send verification email.');
    }
  };

  const handleSignUp = async () => {
    setErrorMessage(null); // Clear previous errors
    try {
      // Validate required fields
      if (!name || !email || !password || !confirmPassword || !dateOfBirth) {
        setErrorMessage('Please fill all required fields.');
        return;
      }

      // Validate Gmail address
      const gmailValidation = validateGmailAddress(email);
      if (!gmailValidation.valid) {
        setErrorMessage(gmailValidation.error || 'Invalid Gmail address.');
        return;
      }

      // Confirm password match
      if (password !== confirmPassword) {
        setErrorMessage('Password and Confirm Password do not match.');
        return;
      }

      // Enforce password strength
      if (!isStrongPassword(password)) {
        setErrorMessage('Password must include uppercase, lowercase, number, special character, and be 6-15 chars long.');
        return;
      }

      // Validate date of birth format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateOfBirth)) {
        setErrorMessage('Please enter date in YYYY-MM-DD format.');
        return;
      }

      // Check if user is too young (under 5)
      const userAge = calculateAge(dateOfBirth);
      if (userAge < 5) {
        setErrorMessage('User must be at least 5 years old.');
        return;
      }

      // Child-specific flow - require parent verification
      if (category === 'child' && PARENT_APPROVAL_ENABLED) {
        if (!parentEmail) {
          setErrorMessage('Children must provide a parent email address.');
          return;
        }

        if (verificationStatus !== 'verified') {
          setErrorMessage('Please verify your parent\'s email first by clicking "Send Verification" button.');
          return;
        }
      }

      // Proceed to face capture
      navigateToFaceCapture();

    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('An unexpected error occurred.');
      }
    }
  };

  const navigateToFaceCapture = () => {
    router.push({
      pathname: '/face-capture',
      params: { 
        name, 
        email, 
        password, 
        dateOfBirth,
        category, 
        parentEmail: category === 'child' ? parentEmail : '',
        token: verificationToken || '' 
      },
    });
  };


  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Back Button - Outside header section */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace('/(auth)/Login')}
            >
              <Ionicons name="arrow-back" size={24} color="#2B383D" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            {/* Header Section */}
            <View style={styles.headerSection}>
              <View style={styles.logoContainer}>
                <View style={styles.logoCircle}>
                  <Ionicons name="person-add" size={40} color="#FAFAFA" />
                </View>
              </View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join us and start your fitness journey</Text>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#2B383D" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#8A9BA8"
                  onChangeText={setName}
                  value={name}
                />
              </View>

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
                  placeholder="Create a password"
                  placeholderTextColor="#8A9BA8"
                  secureTextEntry
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrorMessage(null);
                  }}
                  value={password}
                />
              </View>

              {/* Password Strength Checklist */}
              {password.length > 0 && (
                <View style={styles.passwordCriteriaContainer}>
                  <Text style={[styles.criteriaText, password.length >= 6 && password.length <= 15 ? styles.criteriaMet : styles.criteriaUnmet]}>
                    <Ionicons name={password.length >= 6 && password.length <= 15 ? "checkmark-circle" : "close-circle"} size={14} /> 6-15 characters
                  </Text>
                  <Text style={[styles.criteriaText, /[A-Z]/.test(password) ? styles.criteriaMet : styles.criteriaUnmet]}>
                    <Ionicons name={/[A-Z]/.test(password) ? "checkmark-circle" : "close-circle"} size={14} /> 1 Uppercase
                  </Text>
                  <Text style={[styles.criteriaText, /[a-z]/.test(password) ? styles.criteriaMet : styles.criteriaUnmet]}>
                    <Ionicons name={/[a-z]/.test(password) ? "checkmark-circle" : "close-circle"} size={14} /> 1 Lowercase
                  </Text>
                  <Text style={[styles.criteriaText, /\d/.test(password) ? styles.criteriaMet : styles.criteriaUnmet]}>
                    <Ionicons name={/\d/.test(password) ? "checkmark-circle" : "close-circle"} size={14} /> 1 Number
                  </Text>
                  <Text style={[styles.criteriaText, /[^A-Za-z0-9]/.test(password) ? styles.criteriaMet : styles.criteriaUnmet]}>
                    <Ionicons name={/[^A-Za-z0-9]/.test(password) ? "checkmark-circle" : "close-circle"} size={14} /> 1 Special Character
                  </Text>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Ionicons name="shield-checkmark" size={20} color="#2B383D" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor="#8A9BA8"
                  secureTextEntry
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setErrorMessage(null);
                  }}
                  value={confirmPassword}
                />
                {confirmPassword.length > 0 && (
                  <Ionicons 
                    name={password === confirmPassword ? "checkmark-circle" : "close-circle"} 
                    size={20} 
                    color={password === confirmPassword ? "#4CAF50" : "#F44336"} 
                    style={{ marginLeft: 8 }} 
                  />
                )}
              </View>

              {/* Date of Birth Field */}
              <DateOfBirthPicker
                value={dateOfBirth}
                onDateChange={handleDateOfBirthChange}
                placeholder="Date of Birth (YYYY-MM-DD)"
              />

              {/* Auto Age Category Display based on DOB */}
              {dateOfBirth ? (
                <View style={styles.ageDisplay}>
                  <Text style={styles.ageText}>Age: {calculateAge(dateOfBirth)} years</Text>
                  <Text style={styles.categoryText}>
                    Category: {category === 'child' ? 'Child (Under 16)' : category === 'adult' ? 'Adult (16-40)' : 'Old (40+)'}
                  </Text>
                  {calculateAge(dateOfBirth) < 5 && (
                    <Text style={[styles.categoryText, { color: '#D32F2F' }]}>⚠️ Under 5 - Signup not allowed</Text>
                  )}
                </View>
              ) : null}

              {/* Conditional Parent Email Field */}
              {category === 'child' && (
                <>
                  <View style={styles.inputContainer}>
                    <Ionicons name="people-outline" size={20} color="#2B383D" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Parent's email address"
                      placeholderTextColor="#8A9BA8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onChangeText={(text) => {
                        setParentEmail(text);
                        // Reset verification if email changes after verification
                        if (verificationStatus === 'verified') {
                          setVerificationStatus('none');
                          setVerificationToken(null);
                          setIsListening(false);
                        }
                      }}
                      value={parentEmail}
                    />
                  </View>

                  {/* Send Verification Button */}
                  <TouchableOpacity 
                    style={[
                      styles.verificationButton,
                      verificationStatus === 'verified' && styles.verifiedButton,
                      (verificationStatus === 'sending' || verificationStatus === 'verified' || !parentEmail) && styles.disabledButton
                    ]}
                    onPress={handleSendVerification}
                    disabled={verificationStatus === 'sending' || verificationStatus === 'verified' || !parentEmail}
                  >
                    {verificationStatus === 'sending' && (
                      <ActivityIndicator size="small" color="#FAFAFA" style={{ marginRight: 8 }} />
                    )}
                    {verificationStatus === 'verified' && (
                      <Ionicons name="checkmark-circle" size={20} color="#FAFAFA" style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.verificationButtonText}>
                      {verificationStatus === 'none' && 'Send Verification'}
                      {verificationStatus === 'sending' && 'Sending...'}
                      {verificationStatus === 'pending' && 'Resend Code'}
                      {verificationStatus === 'verified' && '✅ Parent Verified!'}
                    </Text>
                  </TouchableOpacity>

                  {/* OTP Entry — shown after code is sent */}
                  {verificationStatus === 'pending' && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={{ color: '#2B383D', fontSize: 14, marginBottom: 6, fontWeight: '600' }}>
                        📞 Enter the 6-digit code from your parent:
                      </Text>
                      <View style={styles.inputContainer}>
                        <Ionicons name="keypad-outline" size={20} color="#2B383D" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="6-digit code"
                          placeholderTextColor="#8A9BA8"
                          keyboardType="number-pad"
                          maxLength={6}
                          value={parentOtpInput}
                          onChangeText={setParentOtpInput}
                        />
                      </View>
                      <TouchableOpacity
                        style={[styles.verificationButton, { backgroundColor: '#27AE60', marginTop: 8 }]}
                        onPress={async () => {
                          if (!parentOtpInput || parentOtpInput.length !== 6) {
                            Alert.alert('Invalid Code', 'Please enter the full 6-digit code.');
                            return;
                          }
                          if (!verificationToken) {
                            Alert.alert('Error', 'No verification session found. Please resend.');
                            return;
                          }
                          const { verifyParentOTP } = await import('../../utils/ParentApproval');
                          const verifyResult = await verifyParentOTP(verificationToken, parentOtpInput);
                          if (verifyResult.ok) {
                            setVerificationStatus('verified');
                            Alert.alert('✅ Verified!', 'Parent code accepted! You can now continue.', [{ text: 'Continue' }]);
                          } else {
                            Alert.alert('❌ Wrong Code', verifyResult.message || 'Incorrect code. Try again.');
                          }
                        }}
                      >
                        <Text style={styles.verificationButtonText}>Verify Code</Text>
                      </TouchableOpacity>

                      {/* Single-phone helper: show the OTP directly */}
                      {generatedOtpCode && (
                        <TouchableOpacity
                          style={[styles.verificationButton, { backgroundColor: '#6C757D', marginTop: 8 }]}
                          onPress={() => {
                            Alert.alert(
                              '🔑 Parent Approval Code',
                              `The code is:\n\n${generatedOtpCode}\n\nEnter this in the field above to complete verification.\n\n(In a real 2-device setup, only the parent would see this in their dashboard.)`,
                              [
                                { text: 'Enter Code', onPress: () => setParentOtpInput(generatedOtpCode) },
                                { text: 'Close' },
                              ]
                            );
                          }}
                        >
                          <Ionicons name="eye-outline" size={16} color="#FAFAFA" style={{ marginRight: 6 }} />
                          <Text style={styles.verificationButtonText}>Show Code (Single Device)</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              )}

              {/* Error Message Display */}
              {errorMessage && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={20} color="#F44336" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              <TouchableOpacity 
                style={[
                  styles.primaryButton,
                  (category === 'child' && verificationStatus !== 'verified') && styles.disabledButton
                ]}
                onPress={handleSignUp}
                disabled={category === 'child' && verificationStatus !== 'verified'}
              >
                <Text style={styles.primaryButtonText}>Continue to Face Registration</Text>
                <Ionicons name="arrow-forward" size={20} color="#FAFAFA" style={styles.buttonIcon} />
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footerSection}>
              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/Login')}>
                  <Text style={styles.loginLink}>Sign In</Text>
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
    paddingBottom: height * 0.05,
  },
  container: {
    flex: 1,
    paddingHorizontal: width * 0.06,
  },

  // Header Section
  headerSection: {
    alignItems: 'center',
    marginTop: height * 0.01,
    marginBottom: height * 0.04,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: height * 0.06,
    marginBottom: 20,
    padding: 8,
  },
  backText: {
    fontSize: 16,
    color: '#2B383D',
    marginLeft: 8,
    fontWeight: '500',
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoCircle: {
    width: 85,
    height: 85,
    borderRadius: 42.5,
    backgroundColor: '#2B383D',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#2B383D',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#2B383D',
    textAlign: 'center',
    lineHeight: 22,
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
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inputIcon: {
    marginRight: 12,
    color: '#2B383D',
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#2B383D',
    fontWeight: '400',
  },
  selectorContainer: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#DADCE0',
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectorLabel: {
    fontSize: 16,
    color: '#2B383D',
    marginLeft: 12,
    fontWeight: '500',
  },
  pickerContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    color: '#2B383D',
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
    backgroundColor: '#9E9E9E',
    opacity: 0.6,
  },
  verificationButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  verifiedButton: {
    backgroundColor: '#4CAF50',
  },
  verificationButtonText: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '600',
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

  // Footer Section
  footerSection: {
    marginTop: height * 0.05,
    paddingBottom: height * 0.02,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#2B383D',
  },
  loginLink: {
    fontSize: 14,
    color: '#2B383D',
    fontWeight: '500',
  },
  
  // Age Display
  ageDisplay: {
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  ageText: {
    fontSize: 16,
    color: '#2B383D',
    fontWeight: '600',
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  passwordCriteriaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    marginTop: -8,
    paddingHorizontal: 4,
  },
  criteriaText: {
    fontSize: 12,
    marginRight: 12,
    marginBottom: 4,
  },
  criteriaMet: {
    color: '#4CAF50',
  },
  criteriaUnmet: {
    color: '#8A9BA8',
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
