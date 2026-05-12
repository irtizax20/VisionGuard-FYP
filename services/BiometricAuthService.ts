import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';
import SecureStorageService from './SecureStorageService';

export enum BiometricType {
  FINGERPRINT = 'fingerprint',
  FACE_ID = 'faceId',
  IRIS = 'iris',
  NONE = 'none'
}

export interface BiometricResult {
  success: boolean;
  error?: string;
  biometricType?: BiometricType;
}

class BiometricAuthService {
  private static instance: BiometricAuthService;

  static getInstance(): BiometricAuthService {
    if (!BiometricAuthService.instance) {
      BiometricAuthService.instance = new BiometricAuthService();
    }
    return BiometricAuthService.instance;
  }

  // Check if biometric authentication is available
  async isBiometricAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      console.log(`🔍 Biometric check - Hardware: ${hasHardware}, Enrolled: ${isEnrolled}`);
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('❌ Error checking biometric availability:', error);
      // Return false gracefully instead of throwing to allow fallback authentication
      return false;
    }
  }

  // Get available biometric types
  async getAvailableBiometricTypes(): Promise<BiometricType[]> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const biometricTypes: BiometricType[] = [];

      types.forEach(type => {
        switch (type) {
          case LocalAuthentication.AuthenticationType.FINGERPRINT:
            biometricTypes.push(BiometricType.FINGERPRINT);
            break;
          case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
            biometricTypes.push(BiometricType.FACE_ID);
            break;
          case LocalAuthentication.AuthenticationType.IRIS:
            biometricTypes.push(BiometricType.IRIS);
            break;
        }
      });

      console.log('🔒 Available biometric types:', biometricTypes);
      return biometricTypes;
    } catch (error) {
      console.error('❌ Error getting biometric types:', error);
      return [];
    }
  }

  // Authenticate with biometrics
  async authenticateWithBiometrics(reason: string = 'Please verify your identity to access Vision Guard'): Promise<BiometricResult> {
    try {
      // Check if biometric is available
      const isAvailable = await this.isBiometricAvailable();
      if (!isAvailable) {
        return {
          success: false,
          error: 'Biometric authentication is not available on this device'
        };
      }

      // Get biometric types to show appropriate message
      const types = await this.getAvailableBiometricTypes();
      let promptMessage = reason;
      
      // Always prefer Face ID messaging for better UX
      if (types.includes(BiometricType.FACE_ID)) {
        promptMessage = 'Look at your front camera to unlock Vision Guard';
      } else if (types.includes(BiometricType.FINGERPRINT)) {
        promptMessage = 'Look at your camera or use biometric to unlock Vision Guard';
      } else {
        promptMessage = 'Use biometric authentication to unlock Vision Guard';
      }

      console.log('🔐 Starting biometric authentication...');

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
        requireConfirmation: true,
      });

      if (result.success) {
        console.log('✅ Biometric authentication successful');
        await SecureStorageService.updateLastAuthentication();
        
        return {
          success: true,
          biometricType: types[0] // Return the first available type
        };
      } else {
        console.log('❌ Biometric authentication failed:', result.error);
        return {
          success: false,
          error: result.error || 'Authentication failed'
        };
      }
    } catch (error) {
      console.error('❌ Biometric authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication error'
      };
    }
  }

  // Enable biometric authentication for auto-login
  async enableBiometricAuth(): Promise<boolean> {
    try {
      const isAvailable = await this.isBiometricAvailable();
      if (!isAvailable) {
        Alert.alert(
          '🔒 Biometric Authentication',
          'Biometric authentication is not available on this device. Please enable Face ID, fingerprint, or other biometric authentication in your device settings.',
          [{ text: 'OK' }]
        );
        return false;
      }

      // Test authentication first
      const authResult = await this.authenticateWithBiometrics('Enable biometric authentication for Vision Guard?');
      
      if (authResult.success) {
        await SecureStorageService.saveBiometricSettings(true);
        
        const types = await this.getAvailableBiometricTypes();
        // Always prefer Face ID in UI regardless of actual hardware
        const typeString = 'Face ID';
        
        Alert.alert(
          '✅ Success',
          `${typeString} authentication has been enabled for Vision Guard. You can now use it to quickly access the app.`,
          [{ text: 'Great!' }]
        );
        
        return true;
      } else {
        Alert.alert(
          '❌ Setup Failed',
          'Biometric authentication setup was cancelled or failed. You can try again later in Settings.',
          [{ text: 'OK' }]
        );
        return false;
      }
    } catch (error) {
      console.error('❌ Error enabling biometric auth:', error);
      Alert.alert(
        '❌ Error',
        'There was an error setting up biometric authentication. Please try again.',
        [{ text: 'OK' }]
      );
      return false;
    }
  }

  // Disable biometric authentication
  async disableBiometricAuth(): Promise<boolean> {
    try {
      await SecureStorageService.saveBiometricSettings(false);
      console.log('🔓 Biometric authentication disabled');
      return true;
    } catch (error) {
      console.error('❌ Error disabling biometric auth:', error);
      return false;
    }
  }

  // Check if user should be prompted to enable biometrics
  async shouldPromptForBiometrics(): Promise<boolean> {
    try {
      const biometricSettings = await SecureStorageService.getBiometricSettings();
      const isAvailable = await this.isBiometricAvailable();
      
      // Prompt if biometrics are available but not enabled
      return isAvailable && !biometricSettings.enabled;
    } catch (error) {
      console.error('❌ Error checking biometric prompt status:', error);
      // Return false gracefully - don't prompt if there's an error
      return false;
    }
  }

  // Get user-friendly biometric type name
  getBiometricTypeName(type: BiometricType): string {
    switch (type) {
      case BiometricType.FACE_ID:
        return 'Face ID';
      case BiometricType.FINGERPRINT:
        return 'Fingerprint';
      case BiometricType.IRIS:
        return 'Iris';
      default:
        return 'Biometric';
    }
  }
}

export default BiometricAuthService.getInstance();
