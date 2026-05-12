// firebase/parentFirebaseConfig.ts - Secondary Firebase app for Parent Verification flows
import { getApps, initializeApp, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { PARENT_VERIFICATION_FIREBASE_CONFIG } from '../constants/config';

let parentApp: FirebaseApp;

try {
  const existing = getApps().find(a => a.name === 'parentVerification');
  parentApp = existing ? getApp('parentVerification') : initializeApp(PARENT_VERIFICATION_FIREBASE_CONFIG, 'parentVerification');
} catch (e) {
  // Fallback in case getApp throws
  parentApp = initializeApp(PARENT_VERIFICATION_FIREBASE_CONFIG, 'parentVerification');
}

const parentAuth: Auth = getAuth(parentApp);
const parentDb: Firestore = getFirestore(parentApp);

export { parentApp, parentAuth, parentDb };
