// Configuration constants for the Vision Guard app
import Constants from 'expo-constants';

// Helper to safely get environment variables
const getEnvVar = (key: string, fallback: string = ''): string => {
  return Constants.expoConfig?.extra?.[key] || fallback;
};

// Firebase Configuration (Primary app)
export const FIREBASE_CONFIG = {
  apiKey: getEnvVar('firebaseApiKey'),
  authDomain: getEnvVar('firebaseAuthDomain'),
  projectId: getEnvVar('firebaseProjectId'),
  storageBucket: getEnvVar('firebaseStorageBucket'),
  messagingSenderId: getEnvVar('firebaseMessagingSenderId'),
  appId: getEnvVar('firebaseAppId'),
  measurementId: getEnvVar('firebaseMeasurementId')
} as const;

// Validate critical Firebase config values in development
if (__DEV__) {
  const requiredFields = ['apiKey', 'projectId', 'authDomain'];
  const missingFields = requiredFields.filter(field => !FIREBASE_CONFIG[field as keyof typeof FIREBASE_CONFIG]);
  
  if (missingFields.length > 0) {
    console.warn(`⚠️ Missing Firebase environment variables: ${missingFields.join(', ')}. Please check your .env file and app.config.js`);
  }
}

// Separate Firebase project config for Parent Verification flows (secondary app)
export const PARENT_VERIFICATION_FIREBASE_CONFIG = {
  apiKey: getEnvVar('firebaseApiKey'),
  authDomain: getEnvVar('firebaseAuthDomain'),
  projectId: getEnvVar('firebaseProjectId'),
  storageBucket: getEnvVar('firebaseStorageBucket'),
  messagingSenderId: getEnvVar('firebaseMessagingSenderId'),
  appId: getEnvVar('firebaseAppId'),
  measurementId: getEnvVar('firebaseMeasurementId')
} as const;

// App Configuration
export const APP_CONFIG = {
  name: "Vision Guard",
  version: "1.0.0",
  scheme: "visionguard"
} as const;

// Encryption key for face data (should be stored securely in production)
// In production, use expo-secure-store or similar secure storage
export const ENCRYPTION_KEY = getEnvVar('encryptionKey', 'VisionGuard-Face-Encryption-Key-2025-Secure');

export default {
  FIREBASE_CONFIG,
  APP_CONFIG,
  ENCRYPTION_KEY
};
