import { NativeModules } from 'react-native';

const { TTSSettings } = NativeModules;

export interface TTSSettingsService {
  setLanguagePreference(language: 'english' | 'urdu'): Promise<boolean>;
  getLanguagePreference(): Promise<'english' | 'urdu'>;
  getAvailableLanguages(): Promise<string[]>;
  testVoice(language: 'english' | 'urdu'): Promise<boolean>;
  isLanguageAvailable(language: 'english' | 'urdu'): Promise<boolean>;
}

class TTSSettingsServiceImpl implements TTSSettingsService {
  /**
   * Set the preferred language for TTS voice alerts
   * @param language - 'english' or 'urdu'
   * @returns Promise<boolean> - true if successful
   */
  async setLanguagePreference(language: 'english' | 'urdu'): Promise<boolean> {
    try {
      const result = await TTSSettings.setLanguagePreference(language);
      console.log(`✅ TTS language preference set to: ${language}`);
      return result;
    } catch (error) {
      console.error('❌ Error setting TTS language preference:', error);
      throw error;
    }
  }

  /**
   * Get the current language preference
   * @returns Promise<'english' | 'urdu'>
   */
  async getLanguagePreference(): Promise<'english' | 'urdu'> {
    try {
      const language = await TTSSettings.getLanguagePreference();
      console.log(`📖 Current TTS language: ${language}`);
      return language;
    } catch (error) {
      console.error('❌ Error getting TTS language preference:', error);
      return 'english'; // Default fallback
    }
  }

  /**
   * Get list of available languages
   * @returns Promise<string[]>
   */
  async getAvailableLanguages(): Promise<string[]> {
    try {
      const languages = await TTSSettings.getAvailableLanguages();
      return languages;
    } catch (error) {
      console.error('❌ Error getting available languages:', error);
      return ['english', 'urdu']; // Default fallback
    }
  }

  /**
   * Test voice with a sample message in the specified language
   * @param language - 'english' or 'urdu'
   * @returns Promise<boolean> - true if test was successful
   */
  async testVoice(language: 'english' | 'urdu'): Promise<boolean> {
    try {
      console.log(`🔊 Testing voice for: ${language}`);
      const result = await TTSSettings.testVoice(language);
      console.log(`✅ Voice test ${result ? 'successful' : 'failed'}`);
      return result;
    } catch (error: any) {
      console.error('❌ Error testing voice:', error);
      
      // Handle language not supported error
      if (error.code === 'LANG_NOT_SUPPORTED') {
        throw new Error(
          `${language === 'urdu' ? 'Urdu' : 'English'} language is not available on this device. ` +
          'Please install the language data from your device settings.'
        );
      }
      throw error;
    }
  }

  /**
   * Check if a language is available on the device
   * @param language - 'english' or 'urdu'
   * @returns Promise<boolean> - true if language is available
   */
  async isLanguageAvailable(language: 'english' | 'urdu'): Promise<boolean> {
    try {
      const available = await TTSSettings.isLanguageAvailable(language);
      console.log(`📱 ${language} TTS available: ${available}`);
      return available;
    } catch (error) {
      console.error('❌ Error checking language availability:', error);
      return false;
    }
  }
}

export default new TTSSettingsServiceImpl();
