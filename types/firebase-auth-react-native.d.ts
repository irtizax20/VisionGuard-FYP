declare module 'firebase/auth/react-native' {
  import type { Persistence } from 'firebase/auth';

  /**
   * Minimal typing for React Native Firebase Auth persistence helper.
   * Runtime implementation is provided by the Firebase JS SDK.
   */
  export function getReactNativePersistence(storage: any): Persistence;
}

