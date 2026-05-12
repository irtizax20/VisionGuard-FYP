// firebase/firestorePatch.ts
// This file contains patches and workarounds for Firebase Firestore issues

import { Platform } from 'react-native';

/**
 * Apply patches for Firebase Firestore compatibility issues
 */
export function applyFirestorePatches() {
  // Patch for React Native AsyncIterator issue
  if (Platform.OS !== 'web') {
    // Patch global symbols that Firebase expects
    if (typeof global !== 'undefined') {
      // Ensure Symbol.asyncIterator exists
      if (!global.Symbol || !global.Symbol.asyncIterator) {
        if (!global.Symbol) {
          global.Symbol = {} as any;
        }
        if (!global.Symbol.asyncIterator) {
          (global.Symbol as any).asyncIterator = '@@asyncIterator';
        }
      }
      
      // Patch setImmediate if not available
      if (!(global as any).setImmediate) {
        (global as any).setImmediate = (callback: Function, ...args: any[]) => {
          return setTimeout(() => callback(...args), 0);
        };
      }

      // Patch clearImmediate if not available
      if (!(global as any).clearImmediate) {
        (global as any).clearImmediate = (id: any) => {
          return clearTimeout(id);
        };
      }
    }
    
    // Suppress specific console warnings from Firebase
    const originalWarn = console.warn;
    console.warn = (...args) => {
      const message = args.join(' ');
      
      // Skip Firebase internal assertion warnings and permission warnings
      if (
        message.includes('FIRESTORE') && 
        message.includes('INTERNAL ASSERTION FAILED') ||
        message.includes('Unexpected state') ||
        message.includes('Missing or insufficient permissions') ||
        message.includes('permission-denied')
      ) {
        return; // Suppress this warning
      }
      
      // Call original warn for other messages
      originalWarn.apply(console, args);
    };
    
    console.log('🔧 Firebase Firestore patches applied');
  }
}

export async function resetFirestoreConnection() {
  try {
    const { enableNetwork, disableNetwork } = await import('firebase/firestore');
    const { db } = await import('./firebaseConfig');
    
    // Disable and re-enable network to reset connection state
    await disableNetwork(db);
    await new Promise(resolve => setTimeout(resolve, 100));
    await enableNetwork(db);
    
    console.log('🔄 Firestore connection reset');
  } catch (error) {
    console.warn('⚠️ Could not reset Firestore connection:', error);
  }
}
