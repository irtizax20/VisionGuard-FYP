import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const Environment = {
  // Check if we're in development mode
  isDevelopment: __DEV__,
  
  // Get the correct redirect URI based on platform
  getRedirectUri: () => {
    if (Platform.OS === 'web') {
      // For web, use localhost in development
      if (__DEV__ && typeof window !== 'undefined' && window.location) {
        return `${window.location.origin}/auth/callback`;
      }
      // For production web
      return 'https://your-domain.com/auth/callback';
    }
    
    // For mobile (iOS/Android), use Expo's auth proxy
    return 'https://auth.expo.io/@wajahat001/Blinkfit';
  },

  // Google OAuth specific configuration
  getGoogleConfig: () => ({
    clientId: '969589250918-sl8432rau67ken8rqnvurkcpkscf1og7.apps.googleusercontent.com',
    // Add platform-specific client IDs if needed
    iosClientId: '969589250918-sl8432rau67ken8rqnvurkcpkscf1og7.apps.googleusercontent.com',
    androidClientId: '969589250918-sl8432rau67ken8rqnvurkcpkscf1og7.apps.googleusercontent.com',
    webClientId: '969589250918-sl8432rau67ken8rqnvurkcpkscf1og7.apps.googleusercontent.com',
  }),

  // Parent approval server endpoints (to be filled after deploying Firebase Functions)
  parentApproval: {
    requestUrl: Constants.expoConfig?.extra?.PARENT_APPROVAL_REQUEST_URL || '',
    verifyUrl: Constants.expoConfig?.extra?.PARENT_APPROVAL_VERIFY_URL || '',
  },

  // Debug info
  getDebugInfo: () => ({
    platform: Platform.OS,
    version: Platform.Version,
    constants: Constants.expoConfig,
    manifest: Constants.expoConfig,
  })
};
