# 01 - BUG FIXES EXPLAINED (All Bugs Found + Fixes)
**Reconstructed 2026-08-28**

## Critical Bugs (App Won't Run)

### Bug 1: `bg_floating_bubble.xml` Missing - Build Failed
- **File:** `android/app/src/main/res/drawable/bg_floating_bubble.xml`
- **Error:** `AAPT: error: resource drawable/bg_floating_bubble not found` in `layout_floating_bubble.xml`
- **Root Cause:** `VisionGuardOverlayService.kt` uses `R.layout.layout_floating_bubble` which references `@drawable/bg_floating_bubble` but file was missing in initial commits
- **Fix (DONE in c71c0b6):** Created `bg_floating_bubble.xml` with shape drawable (rounded corners, #2B383D background)
- **Status:** ✅ Fixed

### Bug 2: `screen-time.tsx` Stub - Screen Time Tab Blank
- **File:** `app/screen-time.tsx:15-20`
- **Code:**
  ```tsx
  const refreshDailyUsage = async () => { };
  const hasPermission = false;
  const isLoading = false;
  ```
- **Root Cause:** Placeholder after removing old tracking system (Main.tsx:529 comment "Removed: Screen Time and Daily Summary (old tracking system removed)")
- **Fix:**
  ```tsx
  import { useScreenTime } from '../contexts/ScreenTimeContext';
  const { hasPermission, isLoading, refreshScreenTime, screenTimeSeconds } = useScreenTime();
  // Use real data
  ```
  Or use `NativeScreenTrackingService.getStatus()` + `getDailyUsage()`
- **Status:** ❌ Open - needs fix

### Bug 3: `parent-approve.html` Wrong Firebase Project
- **File:** `public/parent-approve.html:50-57`
- **Code:**
  ```js
  const firebaseConfig = {
    apiKey: "AIzaSyAjMg01e7LUVPjFeM3W-1GUQOPe3nPzKhU",
    projectId: "blinkfit-ca40a" // OLD
  };
  ```
- **Should be:** `vision-guard-f0daa` with key `AIzaSyDM0pbu8ye7xKADzRbK8EMdBdmFGvej2u0` (from app.json)
- **Impact:** Parent approval web page fails to verify token because it talks to wrong Firestore
- **Fix:** Update config to vision-guard-f0daa, or make dynamic via `__firebaseConfig` from hosting env
- **Status:** ❌ Open

### Bug 4: Package Name Mismatch - Play Store Signing Fails
- **Files:**
  - `android/app/build.gradle`: `applicationId 'com.wajahat001.blinkfit'`, `namespace 'com.wajahat001.blinkfit'`
  - `app.json`: `android.package: com.irtiza001.visionguard`
  - Kotlin files: `package com.wajahat001.blinkfit`
- **Root Cause:** Project renamed from BlinkFit to VisionGuard but native files not updated
- **Fix:** Choose final package (recommend `com.irtiza001.visionguard`), update:
  1. `app.json` android.package
  2. `android/app/build.gradle` applicationId + namespace
  3. All 12 Kotlin files `package com.irtiza001.visionguard`
  4. `AndroidManifest.xml`
  5. `google-services.json` (re-download)
  6. `MainApplication.kt` + `MainActivity.kt`
- **Status:** ❌ Open

### Bug 5: NDK Version Mismatch - C++ Linking Errors
- **File:** `android/gradle.properties` forces `ndkVersion=26.1.10909125`
- **Build log:** Uses `ndk: 27.1.12297006`
- **Error:** Reanimated needs NDK 26+ but mismatch causes `C++ exception linking errors` (from comment in gradle.properties)
- **Fix:** Either install NDK 26.1.10909125 exactly via SDK Manager > Show Package Details > NDK, or update gradle.properties to `27.1.12297006`
- **Status:** ❌ Open

### Bug 6: Google Services JSON Missing
- **File:** `android/app/google-services.json` - not in repo
- **Error:** `File google-services.json is missing. The Google Services Plugin cannot function without it`
- **Fix:** Firebase Console > vision-guard-f0daa > Project Settings > Your Apps > Android > Download google-services.json -> place in android/app/
- **Status:** ❌ Open (needs manual download)

## High Bugs (Features Broken)

### Bug 7: `face-capture.tsx` Web Dummy Hack
- **File:** `app/(auth)/face-capture.tsx:116-128`
- **Code:**
  ```ts
  if (Platform.OS === 'web') {
    // CRITICAL BUG FIX (PURE EXECUTION): web takePictureAsync hangs forever
    photo = {
      base64: 'web_dummy_base64_data_' + Date.now(),
      uri: 'web_dummy_uri_' + Date.now(),
    };
  }
  ```
- **Impact:** faceHash is not real on web, duplicate detection via faceSigHash fails, face verification will fail on web
- **Fix for FYP:** Document as limitation: "Web platform uses mock face data for testing, physical Android device required for real biometric"
- **Better Fix:** Use `expo-camera` web implementation with canvas capture
- **Status:** 🟡 Workaround intentional for FYP, document it

### Bug 8: Quality Check Disabled
- **File:** `face-capture.tsx:71-95`
- **Code:** `checkImageQuality` always returns `{passed:true}` with strict check commented out
- **Reason:** Comment says "Disabled for FYP to allow laptop cameras in low light"
- **Fix for Final:** Re-enable with better threshold:
  ```ts
  if (variance < 10) return {passed:false, error:'Image too dark'};
  // Increase threshold to 5 for laptop cameras
  ```
- **Status:** 🟡 Intentional workaround, needs re-enable before viva

### Bug 9: Background Tasks Skipped on Android 13+
- **File:** `app/_layout.tsx:40-50` + `services/BackgroundTasks.ts:6`
- **Code:**
  ```ts
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    require('../services/BackgroundTasks');
  } else {
    console.log('Skipping BackgroundTasks (deprecated)');
  }
  ```
- **Impact:** Background sync, daily summary not working on Android 13+ (most modern devices)
- **Fix:** Migrate from `expo-background-fetch` (deprecated) to `expo-background-task`:
  ```bash
  npx expo install expo-background-task
  ```
  Then use `BackgroundTask.registerTaskAsync`
- **Status:** ❌ Open

### Bug 10: `Main.tsx:528` TODO - Screen Time Tracker Placeholder
- **File:** `app/(tabs)/Main.tsx:528`
- **Code:** `// TODO: Add custom screen time tracker here when ready`
- **Context:** Menu items memoized, screen time and daily summary removed from menu
- **Fix:** Add back when `screen-time.tsx` fixed:
  ```ts
  { icon: 'phone-portrait-outline', label: 'Screen Time', onPress: () => router.push('/screen-time') },
  ```
- **Status:** ❌ Open

### Bug 11: API Key Exposed in `app.json` + `eas.json`
- **File:** `app.json` extra: `firebaseApiKey: AIzaSyDM0pbu8ye7xKADzRbK8EMdBdmFGvej2u0`
- **File:** `eas.json` preview env: same key in plain text
- **Impact:** Security risk, anyone can use your Firebase quota
- **Fix:** 
  1. Google Cloud Console > APIs & Services > Credentials > Restrict key to Android app + SHA-1
  2. Remove from app.json extra, use only .env
  3. Update `app.config.js` to read from process.env only
  4. Rotate key: create new key, update .env, delete old
- **Status:** ❌ Open (from SECURITY_CHECKLIST.txt Step 1)

### Bug 12: `index.tsx` Emergency Bypass Hides Real Errors
- **File:** `app/index.tsx:13-35`
- **Code:** Shows DEV emergency options after 5s if still loading: "Go to Login", "Test Blink Detection"
- **Impact:** In DEV, real auth errors are hidden behind bypass, you might miss that `onAuthStateChanged` timeout (3s) is failing
- **Fix:** Keep for DEV but add logging, or remove for production build
- **Status:** 🟡 Low, intentional for DEV

## Medium Bugs (Polish)

### Bug 13: Carousel Infinite Scroll Jump
- **File:** `app/(tabs)/Main.tsx:85-95`
- **Code:** `extendedCarouselData` duplicates last item at start and first at end for infinite scroll, but `currentCarouselIndex` starts at 0 (should start at 1, first real item)
- **Fix:** Start at index 1, handle `onMomentumScrollEnd` to jump without animation when at 0 or last
- **Status:** 🟡 Open

### Bug 14: `BackgroundSyncManager.ts:231` TODO Battery
- **File:** `services/BackgroundSyncManager.ts:231` - `// TODO: Add expo-battery package`
- **Fix:** `npx expo install expo-battery`, check battery level before sync
- **Status:** ❌ Open

### Bug 15: `app.json` `userInterfaceStyle: automatic` but hardcoded colors
- **File:** Many screens hardcode `#2B383D` instead of using `colors.background` from ThemeContext
- **Fix:** Use `useTheme()` everywhere
- **Status:** 🟡 Open

## Build Logs Analysis

- `android/build_log.txt` - UTF-16 log, shows Gradle tasks UP-TO-DATE, Expo modules detected, no fatal error after bg_floating_bubble fix
- `adb_crash.log` - WifiVendorHal errors `getWifiLinkLayerStats_1_3_Internal failed ERROR_NOT_SUPPORTED` - emulator WiFi HAL not supported, not app crash, ignore

## How to Test Fixes

1. After each fix: `npx expo run:android --clear`
2. Check `adb logcat | grep -E "VisionGuard|BlinkDetection|ScreenTime"`
3. Test on physical device for camera + UsageStats (emulator fake)

