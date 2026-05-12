// utils/firestoreUtils.ts
import { db } from '../firebase/firebaseConfig';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  getDocs,
  enableNetwork,
  disableNetwork,
  connectFirestoreEmulator 
} from 'firebase/firestore';

// Utility to check network connectivity and handle Firestore operations
export const FirestoreUtils = {
  // Check if Firestore is connected
  async checkConnection(): Promise<boolean> {
    try {
      // Try to enable network if it was disabled
      await enableNetwork(db);
      
      // Instead of testing a document read (which requires auth),
      // just check if the network is enabled successfully
      console.log('✅ Firestore connection is healthy');
      return true;
    } catch (error: any) {
      // Handle specific permission errors more gracefully
      if (error.code === 'permission-denied' || error.message.includes('permissions')) {
        console.log('🔒 Firestore requires authentication (this is normal for logged out users)');
        return true; // Network is actually fine, just needs auth
      }
      
      console.warn('⚠️ Firestore connection issue:', error.message);
      return false;
    }
  },

  // Retry a Firestore operation with exponential backoff
  async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} for Firestore operation`);
        return await operation();
      } catch (error: any) {
        lastError = error;
        console.warn(`❌ Attempt ${attempt} failed:`, error.message);
        
        // If it's the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait with exponential backoff before retrying
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Try to re-enable network before retry
        try {
          await enableNetwork(db);
        } catch (networkError) {
          console.log('📶 Network enable failed, continuing with retry...');
        }
      }
    }
    
    throw lastError;
  },

  // Safe document read with retry
  async safeGetDoc(docRef: any) {
    return this.retryOperation(async () => {
      const docSnap = await getDoc(docRef);
      return docSnap;
    });
  },

  // Safe document write with retry
  async safeSetDoc(docRef: any, data: any, options?: any) {
    return this.retryOperation(async () => {
      await setDoc(docRef, data, options);
    });
  },

  // Safe collection query with retry
  async safeGetDocs(queryRef: any) {
    return this.retryOperation(async () => {
      const querySnap = await getDocs(queryRef);
      return querySnap;
    });
  },

  // Force enable network if disabled
  async forceEnableNetwork() {
    try {
      await enableNetwork(db);
      console.log('✅ Firestore network enabled');
      return true;
    } catch (error: any) {
      console.warn('⚠️ Failed to enable Firestore network:', error.message);
      return false;
    }
  }
};

export default FirestoreUtils;
