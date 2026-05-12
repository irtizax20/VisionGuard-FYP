import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FontSize = 'small' | 'medium' | 'large';
export type ThemeMode = 'light' | 'dark' | 'auto';

interface AccessibilitySettings {
  fontSize: FontSize;
  themeMode: ThemeMode;
  highContrast: boolean;
  soundEnabled: boolean;
  voiceAlertsEnabled: boolean;
}

const defaultSettings: AccessibilitySettings = {
  fontSize: 'medium',
  themeMode: 'auto',
  highContrast: false,
  soundEnabled: true,
  voiceAlertsEnabled: true,
};

interface ThemeContextType {
  settings: AccessibilitySettings;
  updateSetting: <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => void;
  resetToDefaults: () => void;
  isLoading: boolean;
  systemTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'visionguard_accessibility_settings';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const systemTheme: 'light' | 'dark' = (useColorScheme() === 'dark' ? 'dark' : 'light');

  // Load settings from storage
  const loadSettings = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings);
        setSettings({ ...defaultSettings, ...parsedSettings });
      }
    } catch (error) {
      console.error('Error loading accessibility settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save settings to storage
  const saveSettings = async (newSettings: AccessibilitySettings) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving accessibility settings:', error);
    }
  };

  // Update individual setting
  const updateSetting = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    // Optimistically update state first for immediate UI feedback
    setSettings(newSettings);
    // Then persist to storage
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings)).catch((error) => {
      console.error('Error saving accessibility settings:', error);
    });
  };

  const resetToDefaults = () => {
    saveSettings(defaultSettings);
  };

  useEffect(() => {
    loadSettings();
  }, []);


  const contextValue: ThemeContextType = {
    settings,
    updateSetting,
    resetToDefaults,
    isLoading,
    systemTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};
