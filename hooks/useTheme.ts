import { useThemeContext } from './ThemeContext';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  card: string;
  shadow: string;
  cardBackground: string;
  errorBackground: string;
}

const lightTheme: ThemeColors = {
  primary: '#2B383D',
  secondary: '#4CAF50',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#2B383D',
  textSecondary: '#666666',
  border: '#E0E0E0',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  card: '#FFFFFF',
  shadow: '#000000',
  cardBackground: '#FFFFFF',
  errorBackground: '#FFEBEE',
};

const darkTheme: ThemeColors = {
  primary: '#FFFFFF',
  secondary: '#4CAF50',
  background: '#121212',
  surface: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#B3B3B3',
  border: '#333333',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  card: '#1E1E1E',
  shadow: '#000000',
  cardBackground: '#1E1E1E',
  errorBackground: '#3F1A1C',
};

// High Contrast Light Theme - Using app's color scheme (Black, Off-White, Metal Grey, Dark Green)
const highContrastLightTheme: ThemeColors = {
  primary: '#000000',        // Pure Black for primary elements
  secondary: '#2F5233',      // Dark Green (darker shade for contrast)
  background: '#F5F5F0',     // Off-White background
  surface: '#FFFFFF',        // Pure white for surfaces
  text: '#000000',           // Pure Black text
  textSecondary: '#4A4A4A',  // Dark Metal Grey for secondary text
  border: '#000000',         // Black borders for maximum definition
  success: '#2F5233',        // Dark Green for success
  warning: '#6B6B6B',        // Metal Grey for warnings
  error: '#000000',          // Black for errors (high contrast)
  info: '#2F5233',           // Dark Green for info
  card: '#FAFAF8',           // Light Off-White for cards
  shadow: '#000000',
  cardBackground: '#FAFAF8',
  errorBackground: '#E8E8E8',
};

// High Contrast Dark Theme - Using app's color scheme (Black, Off-White, Metal Grey, Dark Green)
const highContrastDarkTheme: ThemeColors = {
  primary: '#F5F5F0',        // Off-White for primary elements
  secondary: '#6FCF97',      // Bright Green (brighter shade for dark mode)
  background: '#000000',     // Pure Black background
  surface: '#1A1A1A',        // Very dark grey for surfaces
  text: '#F5F5F0',           // Off-White text
  textSecondary: '#5A5A5A',  // Dark Metal Grey for secondary text (better visibility)
  border: '#F5F5F0',         // Off-White borders for definition
  success: '#6FCF97',        // Bright Green for success
  warning: '#5A5A5A',        // Dark Metal Grey for warnings (better visibility)
  error: '#F5F5F0',          // Off-White for errors (high contrast)
  info: '#6FCF97',           // Bright Green for info
  card: '#2A2A2A',           // Dark grey cards
  shadow: '#F5F5F0',
  cardBackground: '#2A2A2A',
  errorBackground: '#1A0000',
};

export const useTheme = () => {
  const { settings, systemTheme } = useThemeContext();

  // Get font size multiplier
  const getFontSizeMultiplier = (): number => {
    switch (settings.fontSize) {
      case 'small':
        return 0.875;  // 87.5% - slightly smaller for compact view
      case 'large':
        return 1.25;   // 125% - significantly larger for accessibility
      default:
        return 1.0;    // 100% - default size
    }
  };

  // Scale font size based on accessibility settings
  const scaleFontSize = (baseSize: number): number => {
    return Math.round(baseSize * getFontSizeMultiplier());
  };

  // Determine current theme based on settings
  const getCurrentTheme = (): 'light' | 'dark' => {
    if (settings.themeMode === 'auto') {
      return systemTheme;
    }
    return settings.themeMode === 'dark' ? 'dark' : 'light';
  };

  const currentTheme = getCurrentTheme();

  // Get theme colors based on current theme and high contrast setting
  const getThemeColors = (): ThemeColors => {
    if (settings.highContrast) {
      return currentTheme === 'dark' ? highContrastDarkTheme : highContrastLightTheme;
    }
    return currentTheme === 'dark' ? darkTheme : lightTheme;
  };

  const colors = getThemeColors();

  // Font styles with accessibility scaling
  const fonts = {
    xsmall: scaleFontSize(10),
    tiny: scaleFontSize(12),
    small: scaleFontSize(14),
    medium: scaleFontSize(16),
    large: scaleFontSize(18),
    xlarge: scaleFontSize(20),
    xxlarge: scaleFontSize(24),
    xxxlarge: scaleFontSize(28),
    huge: scaleFontSize(32),
  };

  // Common spacing values
  const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  };

  // Common border radius values
  const borderRadius = {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    round: 50,
  };

  return {
    colors,
    fonts,
    spacing,
    borderRadius,
    isDark: currentTheme === 'dark',
    isHighContrast: settings.highContrast,
    scaleFontSize,
  };
};
