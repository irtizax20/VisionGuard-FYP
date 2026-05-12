// firebase/firebaseConfig-backup.ts - Alternative config with guaranteed persistence
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { FIREBASE_CONFIG } from '../constants/config';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];

// Initialize Auth - Simplified approach for Firebase v12
let auth;
try {
  auth = getAuth(app);
  console.log('✅ Firebase Auth initialized (backup config)');
} catch (error: any) {
  console.error('❌ Firebase Auth error (backup config):', error);
  throw error;
}

// Initialize other services
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
