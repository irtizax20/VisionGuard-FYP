// firebase/firebaseConfig.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, browserLocalPersistence, getAuth, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { Firestore, getFirestore, initializeFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import { FIREBASE_CONFIG } from '../constants/config';

// Use the Firebase configuration from constants
const firebaseConfig = FIREBASE_CONFIG;

// Validate Firebase config to prevent empty initialization
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase configuration is missing required fields. Please check your environment variables.');
  throw new Error('Firebase configuration is incomplete. Check FIREBASE_API_KEY and FIREBASE_PROJECT_ID environment variables.');
}

// Initialize Firebase app (only if not already initialized)
let app: FirebaseApp;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  console.log('🔥 Firebase App initialized');
} else {
  app = getApps()[0];
  console.log('🔥 Using existing Firebase App');
}

// Initialize Auth with persistence
let auth: Auth;

try {
  // Initialize with persistence first (don't call getAuth before this)
  if (Platform.OS === 'web') {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
    console.log('✅ Firebase Auth initialized with web persistence');
  } else {
    // React Native - Let Firebase use default persistence to fix v12 compilation error
    auth = initializeAuth(app);
    console.log('✅ Firebase Auth initialized for React Native');
  }
} catch (error: any) {
  if (error?.code === 'auth/already-initialized') {
    // If auth was already initialized, reuse existing instance
    auth = getAuth(app);
    console.log('✅ Firebase Auth already initialized, using existing instance');
  } else {
    console.error('❌ Firebase Auth initialization error:', error);
    // Fallback to getAuth
    auth = getAuth(app);
    console.log('⚠️ Firebase Auth initialized using fallback');
  }
}

// Initialize Firestore with better error handling and persistence
let db: Firestore;

try {
  // Initialize Firestore with proper settings
  if (Platform.OS !== 'web') {
    // For React Native, use initializeFirestore for better control
    try {
      db = initializeFirestore(app, {
        experimentalForceLongPolling: false,
        ignoreUndefinedProperties: true,
      });
      console.log('✅ Firestore initialized with initializeFirestore for React Native');
    } catch (error: any) {
      if (error.code === 'firestore/already-initialized') {
        db = getFirestore(app);
        console.log('✅ Using existing Firestore instance');
      } else {
        throw error;
      }
    }
  } else {
    // For web, use getFirestore
    db = getFirestore(app);
    console.log('✅ Firestore initialized for Web');
  }
  
  console.log('✅ Firestore initialized successfully');
} catch (error) {
  console.error('❌ Firestore initialization error:', error);
  // Fallback to basic getFirestore
  try {
    db = getFirestore(app);
    console.log('✅ Fallback: Using basic Firestore initialization');
  } catch (fallbackError) {
    console.error('❌ Firestore fallback initialization failed:', fallbackError);
    throw fallbackError;
  }
}

export { auth, db };

