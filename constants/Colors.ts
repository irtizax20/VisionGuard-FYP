/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

// Font size multipliers for accessibility
export const fontSizeMultipliers = {
  small: 0.875,  // 87.5% of base
  medium: 1.0,   // 100% (default)
  large: 1.25,   // 125% of base
};

// Base font sizes (will be multiplied by accessibility multiplier)
export const baseFontSizes = {
  xs: 10,
  small: 12,
  medium: 14,
  base: 16,
  large: 18,
  xlarge: 20,
  xxlarge: 24,
  xxxlarge: 32,
};

// Legacy fontSizes for backward compatibility
export const fontSizes = {
  small: 14,
  medium: 16,
  large: 18,
};

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
  // High Contrast Light Mode - App Color Scheme (Black, Off-White, Metal Grey, Dark Green)
  lightHighContrast: {
    text: '#000000',           // Pure Black
    background: '#F5F5F0',     // Off-White
    tint: '#2F5233',          // Dark Green
    icon: '#000000',           // Black
    tabIconDefault: '#6B6B6B', // Metal Grey
    tabIconSelected: '#2F5233', // Dark Green
    primary: '#000000',        // Black
    secondary: '#2F5233',      // Dark Green
    error: '#000000',          // Black (high contrast)
    success: '#2F5233',        // Dark Green
    warning: '#6B6B6B',        // Metal Grey
    card: '#FAFAF8',           // Light Off-White
    border: '#000000',         // Black borders
    shadow: '#000000',
    surface: '#FFFFFF',        // Pure White
    textSecondary: '#4A4A4A',  // Dark Metal Grey
  },
  // High Contrast Dark Mode - App Color Scheme (Black, Off-White, Metal Grey, Bright Green)
  darkHighContrast: {
    text: '#F5F5F0',           // Off-White
    background: '#000000',     // Pure Black
    tint: '#6FCF97',          // Bright Green
    icon: '#F5F5F0',          // Off-White
    tabIconDefault: '#5A5A5A', // Dark Metal Grey (darker for better contrast)
    tabIconSelected: '#6FCF97', // Bright Green
    primary: '#F5F5F0',        // Off-White
    secondary: '#6FCF97',      // Bright Green
    error: '#F5F5F0',          // Off-White (high contrast)
    success: '#6FCF97',        // Bright Green
    warning: '#5A5A5A',        // Dark Metal Grey (darker for better visibility)
    card: '#2A2A2A',           // Dark Grey
    border: '#F5F5F0',         // Off-White borders
    shadow: '#F5F5F0',
    surface: '#1A1A1A',        // Very Dark Grey
    textSecondary: '#5A5A5A',  // Dark Metal Grey (darker for better visibility)
  },
};
