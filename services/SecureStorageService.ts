import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface BiometricSettings {
  enabled: boolean;
  lastAuthentication: number;
}

class SecureStorageService {
  private static instance: SecureStorageService;
  
  // Storage keys
  private readonly CREDENTIALS_KEY = 'user_credentials';
  private readonly BIOMETRIC_KEY = 'biometric_settings';
  private readonly AUTO_LOGIN_KEY = 'auto_login_enabled';
  private readonly LAST_LOGIN_KEY = 'last_login_time';

  static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService();
    }
    return SecureStorageService.instance;
  }

  // Save user credentials securely
  async saveCredentials(email: string, password: string, rememberMe: boolean = true): Promise<boolean> {
    try {
      const credentials: StoredCredentials = {
        email,
        password,
        rememberMe
      };

      await SecureStore.setItemAsync(this.CREDENTIALS_KEY, JSON.stringify(credentials));
      await AsyncStorage.setItem(this.AUTO_LOGIN_KEY, 'true');
      await AsyncStorage.setItem(this.LAST_LOGIN_KEY, Date.now().toString());
      
      console.log('🔐 Credentials saved securely');
      return true;
    } catch (error) {
      console.error('❌ Error saving credentials:', error);
      return false;
    }
  }

  // Get saved credentials
  async getCredentials(): Promise<StoredCredentials | null> {
    try {
      const credentialsString = await SecureStore.getItemAsync(this.CREDENTIALS_KEY);
      if (credentialsString) {
        const credentials: StoredCredentials = JSON.parse(credentialsString);
        console.log('✅ Retrieved saved credentials for:', credentials.email);
        return credentials;
      }
      return null;
    } catch (error) {
      console.error('❌ Error retrieving credentials:', error);
      return null;
    }
  }

  // Check if auto-login is enabled
  async isAutoLoginEnabled(): Promise<boolean> {
    try {
      const autoLogin = await AsyncStorage.getItem(this.AUTO_LOGIN_KEY);
      return autoLogin === 'true';
    } catch (error) {
      console.error('Error checking auto-login status:', error);
      return false;
    }
  }

  // Save biometric settings
  async saveBiometricSettings(enabled: boolean): Promise<boolean> {
    try {
      const settings: BiometricSettings = {
        enabled,
        lastAuthentication: enabled ? Date.now() : 0
      };

      await AsyncStorage.setItem(this.BIOMETRIC_KEY, JSON.stringify(settings));
      console.log(`🔒 Biometric authentication ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    } catch (error) {
      console.error('❌ Error saving biometric settings:', error);
      return false;
    }
  }

  // Get biometric settings
  async getBiometricSettings(): Promise<BiometricSettings> {
    try {
      const settingsString = await AsyncStorage.getItem(this.BIOMETRIC_KEY);
      if (settingsString) {
        return JSON.parse(settingsString);
      }
      return { enabled: false, lastAuthentication: 0 };
    } catch (error) {
      console.error('Error retrieving biometric settings:', error);
      return { enabled: false, lastAuthentication: 0 };
    }
  }

  // Update last authentication time
  async updateLastAuthentication(): Promise<void> {
    try {
      const settings = await this.getBiometricSettings();
      settings.lastAuthentication = Date.now();
      await AsyncStorage.setItem(this.BIOMETRIC_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error updating last authentication:', error);
    }
  }

  // Check if biometric re-authentication is needed (every 24 hours)
  async isBiometricReauthNeeded(): Promise<boolean> {
    try {
      const settings = await this.getBiometricSettings();
      if (!settings.enabled) return false;
      
      const now = Date.now();
      const hoursSinceAuth = (now - settings.lastAuthentication) / (1000 * 60 * 60);
      
      // Require re-authentication after 24 hours
      return hoursSinceAuth > 24;
    } catch (error) {
      console.error('Error checking biometric reauth:', error);
      return true;
    }
  }

  // Clear all stored data (for logout)
  async clearAllData(): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(this.CREDENTIALS_KEY);
      await AsyncStorage.removeItem(this.AUTO_LOGIN_KEY);
      await AsyncStorage.removeItem(this.BIOMETRIC_KEY);
      await AsyncStorage.removeItem(this.LAST_LOGIN_KEY);
      
      console.log('🗑️ All stored credentials cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing stored data:', error);
      return false;
    }
  }

  // Disable auto-login (but keep credentials for manual login)
  async disableAutoLogin(): Promise<boolean> {
    try {
      await AsyncStorage.setItem(this.AUTO_LOGIN_KEY, 'false');
      console.log('🔓 Auto-login disabled');
      return true;
    } catch (error) {
      console.error('❌ Error disabling auto-login:', error);
      return false;
    }
  }

  // Get last login time
  async getLastLoginTime(): Promise<number> {
    try {
      const timeString = await AsyncStorage.getItem(this.LAST_LOGIN_KEY);
      return timeString ? parseInt(timeString) : 0;
    } catch (error) {
      console.error('Error getting last login time:', error);
      return 0;
    }
  }
}

export default SecureStorageService.getInstance();
