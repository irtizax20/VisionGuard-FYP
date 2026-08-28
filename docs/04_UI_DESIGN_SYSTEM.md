# 04 - UI DESIGN SYSTEM (VisionGuard)
**Reconstructed 2026-08-28**

## Design Philosophy

- **Eye Health = Calm, Dark, Professional** - not bright medical white
- **Primary Color:** `#2B383D` (dark teal/gray) - used in splash, buttons, headers
- **Background:** `#FAFAFA` light, `#121212` dark (from Colors.ts)
- **Accent:** `#4A90E2` blue (20-20-20 tip), `#50C878` green (blink), `#FF8C42` orange (brightness)

## Colors (from constants/Colors.ts)

```ts
// Light
tintColorLight: '#0a7ea4' (approx, check file)
background: '#FAFAFA'
card: '#FFFFFF'
text: '#2B383D'
textSecondary: '#8A9BA8'
primary: '#2B383D'
secondary: '#4A6572'
border: '#DADCE0'
error: '#D32F2F'

// Dark
background: '#121212'
card: '#1E1E1E'
text: '#FAFAFA'
```

## Typography (from hooks/useTheme.ts)

- **Fonts:** SpaceMono-Regular (assets/fonts/SpaceMono-Regular.ttf) + system
- **Sizes:** small 12, medium 14-16, large 18-20, xlarge 24, xxlarge 28
- **Weights:** regular, 600 semibold, bold 700

## Components

### 1. Splash Screen (`app/splash/splashScreen.tsx`)

- Background `#2B383D`, centered logo `assets/logo.png` 120x120, app name "Vision Guard" 40 bold #FAFAFA, tagline "Your Eye Health Companion" 18 #8A9BA8
- Loading bar: container 250x8 #4A555A, fill #FAFAFA animated 0%->100% 2s

### 2. Auth Screens (`app/(auth)/`)

- **Login.tsx:** Header with logo circular + shadow, form with email (Gmail only validation), password with show/hide eye icon, error message red, loading ActivityIndicator, footer "Don't have account? Sign up"
- **Signup.tsx:** Multi-step: DOB picker (DateOfBirthPicker component), category picker (child/adult/old), parent email if child, validation
- **Face Capture/Verification:** Camera full screen, overlay with face guide, torch toggle, capture button, error message, permission handling

### 3. Main (Home) (`app/(tabs)/Main.tsx`)

- **Header:** LogoutButton via `nav.setOptions({headerRight: () => <LogoutButton />})`
- **Carousel:** CARD_WIDTH = width*0.8, SIDE_PADDING = (width-CARD_WIDTH)/2, infinite scroll via extended data [last, ...real, first], auto-slide interval 3s, pulse animation
- **Carousel Data:** 6 cards: 20-20-20 Rule (#4A90E2 eye-outline), Blink More (#50C878 water), Brightness (#FF8C42 sunny), Take Breaks (#9B59B6 pause-circle), Eye Exercises (#E74C3C fitness), Proper Lighting (#F39C12 bulb)
- **Tips:** Eye health tips list with icon + color from theme

### 4. Screen Time (`app/screen-time.tsx` + `components/ScreenTime/`)

- **Permission Card:** Shows Usage Access permission status, button to open settings via `NativeScreenTrackingService.openUsageAccessSettings()`
- **Daily Card:** Total screen time formatted `1h 20m 30s`, apps count, most used app
- **App List:** max 10, show percentage, app name via `ScreenTimeService.getAppName(pkg)` mapping Instagram, YouTube etc
- **Weekly Summary:** Chart (needs implementation) + weekly averages

### 5. Blink Test (`app/blink-test.tsx`)

- **States:** idle, detecting (pulse animation 1->1.15 loop), countdown, result
- **UI:** Camera permission card, detecting indicator with blink flash, current blink count + distance measurements, result card with blinkCount, avg distance, duration, eye images if enabled
- **Toggle:** eyeCaptureEnabled switch, tooCloseWarning with TTS "You are too close"
- **Animations:** pulseAnim (loop), blinkFlashAnim (sequence)

### 6. Eye Images Gallery (`app/eye-images-gallery.tsx`)

- **Header:** Back button + title + clear button (trash icon #D32F2F) if images exist
- **Stats:** Total captures card with icon images-outline #2196F3
- **Image Card:** Timestamp with time-outline icon, save button download-outline #4CAF50, left/right eye images side by side, eye label
- **Empty:** eye-off-outline 80 opacity 0.3, "No eye images", button "Start Blink Test"

### 7. Parent Dashboard (`app/(tabs)/ParentDashboard.tsx`)

- **Card:** Child info row with icon, name 20 bold, email 14, divider, controls: lock/unlock switch with lock-closed/open icons, OTP card with border 1.5, title 15 bold, OTP 24 bold monospace, copy button
- **Empty:** No children message

### 8. Other Screens

- **Analytics:** Header with back button, sectionTitle large 600, weekCard with left border color, dayRow with borderBottom
- **Lock Screen:** Centered lock-closed 120 error color, title 32 bold "Device Locked", subtitle 18 center
- **Report, Setting, Daily Summary, Eye Exercise, Manual Capture, Profile Edit** - similar card-based layout with theme colors

## Theme System

- **ThemeContext:** `hooks/ThemeContext.tsx` provides colors, fonts, spacing, borderRadius, isDark
- **useTheme():** Returns theme object, used in all screens via `const {colors, fonts, spacing, borderRadius} = useTheme()`
- **ThemedText, ThemedView:** Wrapper components that auto use theme

## Spacing & Border Radius (from useTheme)

```ts
spacing: xs 4, sm 8, md 16, lg 24, xl 32
borderRadius: sm 8, md 12, lg 16, xl 24
fonts: small 12, medium 16, large 18, xlarge 20, xxlarge 28
```

## Icons

- **Ionicons** from `@expo/vector-icons` - eye-outline, water-outline, sunny-outline, pause-circle-outline, fitness-outline, bulb-outline, time-outline, download-outline, trash-outline, arrow-back, lock-closed, etc
- **Expo Symbols** for iOS

## Shadows & Elevation

- Card: `elevation: 3, shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: colors.border`
- Logo: circular with shadow

## What Was Planned (INFERRED)

- **Glassmorphism** - README_AUTH.md mentions glassmorphism design, but not implemented - could add blur via `expo-blur`
- **Dark mode toggle** in Settings - currently automatic via system
- **Haptic feedback** - `expo-haptics` installed but not used everywhere, add on button press
- **Animations** - Reanimated already used for carousel, blink test - add more for screen transitions

## For FYP Presentation

- Show color palette slide: #2B383D primary, #FAFAFA background, accent colors for tips
- Show typography: SpaceMono + system, consistent spacing
- Show component consistency: all cards have same borderRadius lg, elevation 3, left border color for categorization
- Mention accessibility: `useAccessibility` hook exists (empty), could add font scaling

## Files to Check

- `constants/Colors.ts` - all colors
- `hooks/useTheme.ts` + `ThemeContext.tsx` - theme system
- `components/ui/` - DateOfBirthPicker, Footer, IconSymbol, LogoutButton, TabBarBackground
- `app/(tabs)/Main.tsx` - carousel + tips design

