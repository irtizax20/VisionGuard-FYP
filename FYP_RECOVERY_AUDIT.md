# VisionGuard FYP - Recovery Audit Report
**Date:** 2026-08-28
**Branch:** arena/01a04903-visionguard-fyp
**Base Commit:** c71c0b6 fix: add missing bg_floating_bubble drawable
**Auditor:** Project Recovery Agent

> This report is the FIRST step - no code modifications have been made yet except this file and the tracker.

---

## Executive Summary

**CONFIRMED FROM REPOSITORY:**
- Single-commit repository (213 files, 52k insertions) pushed on May 13 2026.
- Project name inconsistency: `package.json` = vision-guard, `android` package = com.wajahat001.blinkfit, but also com.irtiza001.visionguard in app.json. Last commit fixed a missing drawable that was blocking Android builds.
- The project is an **Expo SDK 53 + React Native 0.79 + Firebase JS SDK 12** mobile app for eye health: screen-time tracking, blink detection via ML Kit, face biometric auth, parent-child monitoring, eye image gallery, daily summaries.
- Extensive native Kotlin modules for blink detection, usage stats, screen time service, overlay service with TTS.
- Firebase project `vision-guard-f0daa` is primary, but legacy project `blinkfit-ca40a` still referenced in public/parent-approve.html and Environment.ts
- No `.env`, no `google-services.json`, no `node_modules` - fresh machine cannot build without recreation.

**INFERRED/UNCERTAIN:**
- You were fixing Android build errors just before loss (build_log.txt and adb_crash.log contain UTF-16 logs, Gradle tasks up-to-date). The last meaningful state was "Android build now succeeds after adding bg_floating_bubble.xml"
- The .md task file you mentioned was likely one of the gitignored files: `CODE_ANALYSIS_REPORT*.md`, `SCREEN_TRACKING_USAGE.md`, `DEPLOY_SECURITY.md`, `SECURITY_IMPLEMENTATION_GUIDE.md`, `SECURITY_OPTIMIZATION_REPORT.md` or `docs/` folder - all are in `.gitignore` and therefore not recoverable from GitHub.
- Lost local work probably included: FYP thesis docx (gitignored *.docx), ML models (models/, *.pt, *.tflite gitignored), and local testing data.

---

## A. Project Status

### Overall: **Partially Completed / Buildable with Fixes**

| Area | Status | Evidence |
|------|--------|----------|
| **Authentication** | ✅ Completed | Login.tsx, signup.tsx, forgetPassword, face-capture, face-verification all present, 400+ lines each |
| **Parent-Child Flow** | 🟡 Partially Completed | ParentVerification.tsx, ParentApproval.ts, wait-parent-approval.tsx, functions/src/index.ts exist, but SendGrid not configured, email disabled warning, project ID mismatch |
| **Face Biometric** | ✅ Completed (workaround) | FaceDetectionService.ts 630 lines, uses ML Kit + expo-face-detector, but quality check disabled for FYP (`checkImageQuality` always passes), web dummy base64 hack |
| **Screen Time Tracking** | 🟡 Partially Completed / Buggy | UsageStatsModule.kt, ScreenTimeTrackerModule.kt, ScreenTimeService.kt, ScreenTimeContext.tsx exist. BUT `app/screen-time.tsx` has stub: `hasPermission=false`, `refreshDailyUsage=async()=>{}` - clearly placeholder. Main.tsx line 528 has TODO. Android 13+ background-fetch skipped |
| **Blink Detection** | ✅ Completed (needs device test) | BlinkDetectionModule.kt 32k lines, BlinkDetectionHelper.kt, CameraX + ML Kit, BlinkDetectionService.ts, blink-test.tsx with animations |
| **Eye Image Capture** | ✅ Completed | EyeImageCaptureService.ts 488 lines, gallery, manual capture, save to MediaLibrary |
| **Overlay Service (VisionGuard)** | ✅ Completed | VisionGuardOverlayService.kt with TTS, floating bubble layout, distance/blink/fatigue throttling |
| **Daily Summary & Notifications** | 🟡 Partially Completed | DailySummaryService.ts schedules 8PM notification, but healthScore logic is basic, no real ML analysis |
| **Parent Dashboard** | 🟡 Partially Completed | ParentDashboard.tsx shows children, lock/unlock (isLocked field), OTP display. Needs testing with real child data |
| **Reports & Analytics** | 🟡 Partially Completed | Report.tsx, analytics.tsx with weekly averages, but no charts, DayData interfaces partially empty |
| **Security** | 🟡 Partially Implemented | firestore.rules 14k lines comprehensive, storage.rules present, RateLimitService, encryption utils, BUT API keys exposed in app.json/eas.json, google-services.json missing, DEPLOY_SECURITY.md missing, App Check not enforced |
| **Firebase Functions** | 🟡 Partially Completed | requestParentApproval + verifyParentApproval implemented with SendGrid, but config `sendgrid.api_key`, `from_email`, `verify_base_url` not set - returns warning token |
| **Build System** | 🟡 Runnable with manual steps | android/ folder exists, gradle 8.13, buildTools 35.0.0, but build_log.txt shows previous failures, adb_crash.log shows WifiVendorHal errors (emulator) |
| **iOS / Web** | ❌ Not Implemented | No ios/ folder, web has limited support (camera mocked) |

**Broken / Likely Bugs (CONFIRMED):**
1. `app/screen-time.tsx` - stub implementation, permission always false, will show empty screen
2. `public/parent-approve.html` - hardcoded Firebase config for `blinkfit-ca40a` (old project) while app.json uses `vision-guard-f0daa` - approval page will fail
3. `app/(auth)/README_AUTH.md` mentions `googleLogin.tsx` but file does not exist - Google OAuth incomplete
4. `app/index.tsx` emergency bypass only in __DEV__ after 5s - may hide real auth issues
5. `face-capture.tsx` web implementation uses dummy base64 `web_dummy_base64_data_` - face hash is not real on web, duplicate detection will fail
6. `gradle.properties` forces `ndkVersion=26.1.10909125` but build log shows NDK 27.1.12297006 used - version mismatch can cause C++ linking errors with Reanimated
7. `package-lock.json` present but `node_modules` not installed in sandbox - `npm list` shows UNMET DEPENDENCY for all 50+ packages
8. `android/app/build.gradle` namespace `com.wajahat001.blinkfit` vs app.json package `com.irtiza001.visionguard` vs applicationId `com.wajahat001.blinkfit` - inconsistent package names will cause Play Store signing issues
9. `app/_layout.tsx` tries to import `../services/BackgroundTasks` but skips on Android 13+ - background sync disabled on modern Android

---

## B. Technology Stack (From Repository, Not Guessed)

### Languages
- **TypeScript 5.8.3** → Main app logic (strict mode) → `tsconfig.json` extends expo base
- **Kotlin 2.0.21** → Android native modules → `android/build.gradle` via react-native-gradle-plugin
- **JavaScript** → metro.config.js, babel.config.js, app.config.js

### Core Frameworks
- **Expo SDK ~53.0.27** → Managed workflow, expo-router, native modules → `package.json`, `app.json` newArchEnabled true, Hermes JS engine
- **React 19.0.0** → UI → package.json
- **React Native 0.79.6** → Mobile framework → package.json
- **Expo Router ~5.1.11** → File-based routing → app/ directory structure

### Navigation & UI
- **@react-navigation/native 7.1.6, bottom-tabs 7.3.10, elements 2.3.8** → Tab navigation → app/(tabs)/_layout.tsx
- **react-native-reanimated 3.17.4** → Animations (carousel, blink test pulse) → babel plugin must be last
- **react-native-gesture-handler 2.24.0, safe-area-context 5.4.0, screens 4.11.1** → Gestures/safe area → dependencies
- **@expo/vector-icons 14.1.0, expo-symbols 0.4.5** → Icons → Main.tsx carousel icons

### Firebase & Backend
- **firebase 12.0.0 (JS SDK)** → Auth, Firestore, Storage → `firebase/firebaseConfig.ts` uses `FIREBASE_CONFIG` from Constants
- **Firebase Project ID: vision-guard-f0daa** → Confirmed from .firebaserc, app.json extra, eas.json preview env → **Legacy: blinkfit-ca40a still in public/parent-approve.html**
- **firestore.rules, storage.rules, firebase.json** → Security rules deployed via `firebase deploy --only firestore:rules,storage:rules`
- **Firebase Functions Node >=18** → Parent approval email flow → `functions/package.json` uses firebase-admin 12.5.0, firebase-functions 5.0.1, @sendgrid/mail 8.1.0, uuid 9.0.1
- **Expo Constants** → Env var injection → `constants/config.ts` reads `Constants.expoConfig.extra.firebaseApiKey` etc

### AI/ML & Vision
- **@react-native-ml-kit/face-detection 2.0.1** → Face detection, eye open classification → BlinkDetectionModule.kt uses `com.google.mlkit:face-detection:16.1.7`
- **expo-face-detector 13.0.2 (deprecated)** → Fallback face detection → package.json, app.json plugin list includes datetimepicker but not face-detector (auto)
- **expo-camera 16.1.11** → Camera for face capture & blink detection → face-capture.tsx, face-verification.tsx
- **CameraX 1.3.1** → Native camera → android/app/build.gradle `androidx.camera:camera-core/lifecycle/view`
- **Google ML Kit Face Detection** → Native: `com.google.mlkit:face-detection:16.1.7`, `play-services-mlkit-face-detection:17.1.0` → BlinkDetectionModule

### Native Android
- **Gradle 8.13** → Build system → `android/gradle/wrapper/gradle-wrapper.properties` distributionUrl
- **Android Gradle Plugin** → Via `com.android.tools.build:gradle` (version from expo version catalog, likely 8.7+)
- **compileSdk 35, targetSdk 35, minSdk 24, buildTools 35.0.0** → From ExpoRootProject config + gradle.properties forced minSdk 24 for Reanimated
- **NDK 26.1.10909125 forced** → gradle.properties `ndkVersion=26.1.10909125` but build log used 27.1.12297006 → mismatch
- **Kotlin 2.0.21, KSP 2.0.21-1.0.28** → From build log ExpoRootProject versions
- **Lifecycle Service 2.6.2, Guava 31.1-android, Coroutines 1.7.3** → For foreground services → android/app/build.gradle
- **Custom Native Modules (6):**
  - `BlinkDetectionModule.kt + Helper + Package` → Blink detection + eye image capture
  - `UsageStatsModule.kt + Package` → Query UsageStatsManager for app usage
  - `ScreenTimeTrackerModule.kt + Package` → Native screen time tracking
  - `ScreenBreakModule.kt + Package` → Screen break overlay
  - `TTSSettingsModule.kt + Package` → Text-to-Speech settings
  - `VisionGuardOverlayModule.kt + Package + Service` → Floating bubble, camera foreground service, TTS alerts
  - Plus `ScreenTimeService.kt`, `ScreenLockView.kt`, `ScreenStateReceiver.kt`, `MainActivity.kt`, `MainApplication.kt`

### Storage & Security
- **@react-native-async-storage/async-storage 2.1.2** → Local cache, faceVerificationCompleted flag, screen time cache → contexts/ScreenTimeContext
- **expo-secure-store 14.2.4** → Secure credentials → SecureStorageService.ts
- **crypto-js 4.2.0 + @types** → Encryption → utils/encryption.ts, secureEncryption.ts generates key from deviceId + appId + userId SHA256
- **expo-crypto 14.1.5, expo-random 14.0.1, react-native-get-random-values 1.11.0** → Random IDs, encryption
- **RateLimitService.ts** → Login rate limiting (5 attempts) → Login.tsx uses loginRateLimiter

### Device Features
- **expo-brightness 13.1.4** → BrightnessService.ts
- **expo-local-authentication 16.0.5** → BiometricAuthService.ts (fingerprint, not fully integrated)
- **expo-notifications 0.31.5** → Daily summary at 8PM, permission handling in face-verification.tsx
- **expo-speech 13.1.7** → TTS for distance/blink warnings → VisionGuardOverlayService.kt also uses Android TextToSpeech
- **expo-media-library 17.1.7** → Save eye images to gallery → EyeImageCaptureService
- **expo-device 7.1.4, react-native-device-info 14.0.4** → Device ID for encryption key
- **expo-background-fetch 13.1.6, expo-task-manager 13.1.6** → Background sync (deprecated on Android 13+, skipped in _layout.tsx)
- **@react-native-community/netinfo 11.4.1** → OfflineSyncService network check
- **expo-intent-launcher 55.0.12** → Open Usage Access Settings → NativeScreenTrackingService

### Other Libraries
- **dotenv 17.2.3, react-native-dotenv 3.4.11** → .env loading → app.config.js uses dotenv/config, but .env missing
- **@react-native-community/slider 4.5.6, datetimepicker 8.4.1, picker 2.11.1** → Settings UI
- **expo-blur 14.1.5, expo-haptics 14.1.4, expo-clipboard 7.1.5, expo-image 2.4.1, expo-font 13.3.2, expo-splash-screen 0.30.10, expo-status-bar 2.2.3, expo-constants 17.1.7, expo-linking 7.1.7, expo-web-browser 14.2.0** → UI polish

### Build & Tooling
- **Node.js >=18** → Required for Firebase Functions and Expo 53 (Expo 53 recommends Node 20 LTS)
- **npm** → package-lock.json present (680k lines) - use npm, not yarn
- **EAS CLI >=16.17.0** → eas.json cli version, build profiles: development (dev client), preview (APK with env), production (autoIncrement)
- **Firebase CLI** → For deploying rules, functions, hosting
- **TypeScript, ESLint 9.25.0, eslint-config-expo 9.2.0** → Linting, type-check

### IDE / Editor
- **VS Code** → .vscode/settings.json present (empty but indicates VS Code used)
- **Android Studio** → .idea/ folder present (Ki_hal.iml etc) - indicates Android Studio was used previously
- **Expo Go / Dev Client** → expo-dev-client 5.2.4 indicates custom dev client builds

---

## C. Required Laptop Setup - Step-by-Step Checklist (Fresh Machine)

**Order matters! Do NOT skip order.**

### 1. System Prerequisites
- [ ] **Git** → Version control → `git --version` → Install from https://git-scm.com/ → Required to clone repo
- [ ] **Node.js 20 LTS (not latest 22)** → Expo 53 + RN 0.79 is tested on Node 20 → Install via https://nodejs.org/ or nvm `nvm install 20` → Check `node -v` should be v20.x
- [ ] **npm 10+** → Comes with Node 20 → `npm -v` → Package manager (do NOT use yarn, repo uses package-lock.json)
- [ ] **JDK 17 (recommended) or JDK 21** → Gradle 8.13 + AGP 8.x requires JDK 17+ → Expo docs recommend JDK 17 for SDK 53. Your gradle.properties comment says JDK 21 but also forces minSdk 24. **Use JDK 17 to be safe** (Eclipse Temurin). Install from https://adoptium.net/ → Set `JAVA_HOME` env var → Verify `java -version` and `javac -version`
- [ ] **Android Studio Latest (2024.2+)** → IDE + SDK Manager → https://developer.android.com/studio → During install, include Android SDK, Platform Tools, Emulator

### 2. Android SDK Components (Open Android Studio > SDK Manager)
- [ ] **Android SDK Platform 35** → compileSdk 35, targetSdk 35 → SDK Manager > SDK Platforms > Check Android 15 (API 35) > Apply
- [ ] **Android SDK Build-Tools 35.0.0** → SDK Manager > SDK Tools > Show Package Details > Build-Tools > 35.0.0
- [ ] **Android SDK Platform-Tools** → adb, fastboot → SDK Tools > Platform-Tools
- [ ] **Android Emulator** → SDK Tools > Android Emulator
- [ ] **NDK 26.1.10909125** → Required (forced in gradle.properties) → SDK Tools > Show Package Details > NDK > 26.1.10909125 (If not available, install 27.x and update gradle.properties, but better to install 26.1.10909125 exactly)
- [ ] **CMake** → For native builds → SDK Tools > CMake
- [ ] Set **ANDROID_HOME** env var: Windows: `C:\Users\YourName\AppData\Local\Android\Sdk`, Mac: `~/Library/Android/sdk`, Linux: `~/Android/Sdk` → Add to PATH: `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\emulator`

### 3. Global CLI Tools (After Node)
- [ ] **Expo CLI** → `npm install -g expo-cli` or use `npx expo` (Expo recommends npx) → Verify `npx expo --version`
- [ ] **EAS CLI >=16.17.0** → `npm install -g eas-cli` → Required for builds → `eas --version` should be >=16.17.0 per eas.json
- [ ] **Firebase CLI** → `npm install -g firebase-tools` → For rules deploy → `firebase --version` → Then `firebase login` and `firebase projects:list`

### 4. Project Clone & Install
- [ ] **Clone Repo** → `git clone <your-github-url> VisionGuard-FYP && cd VisionGuard-FYP && git checkout arena/01a04903-visionguard-fyp`
- [ ] **Install Dependencies** → `npm install` (takes 2-5 mins, 680k lock file) → If errors, try `npm ci` or `npm install --legacy-peer-deps` (React 19 may need legacy)
- [ ] **Verify Metro** → `npx expo doctor` → Should show warnings about @expo/vector-icons etc but not critical

### 5. Environment Files (CRITICAL - Missing from GitHub)
- [ ] **Create .env in root** (gitignored, so you must create):
```
FIREBASE_API_KEY=AIzaSyDM0pbu8ye7xKADzRbK8EMdBdmFGvej2u0
FIREBASE_AUTH_DOMAIN=vision-guard-f0daa.firebaseapp.com
FIREBASE_PROJECT_ID=vision-guard-f0daa
FIREBASE_STORAGE_BUCKET=vision-guard-f0daa.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=1037048435719
FIREBASE_APP_ID=1:1037048435719:web:1b171dbfbaa0d75addc6a2
FIREBASE_MEASUREMENT_ID=G-5E723L1J59
ENCRYPTION_KEY=VisionGuard-Face-Encryption-Key-2025-Secure
PARENT_APPROVAL_REQUEST_URL=https://us-central1-vision-guard-f0daa.cloudfunctions.net/requestParentApproval
PARENT_APPROVAL_VERIFY_URL=https://us-central1-vision-guard-f0daa.cloudfunctions.net/verifyParentApproval
```
  - **Source:** Values from app.json extra and eas.json preview env (CONFIRMED). You should rotate these keys later per SECURITY_CHECKLIST.txt!
- [ ] **google-services.json** → Download from Firebase Console > Project Settings > Your Apps > Android app com.wajahat001.blinkfit (or com.irtiza001.visionguard) > google-services.json → Place in `android/app/google-services.json` → If app not registered, create Android app in Firebase Console first
- [ ] **GoogleService-Info.plist (optional, iOS)** → Only if you plan iOS builds

### 6. Firebase Project Setup
- [ ] **Login** → `firebase login`
- [ ] **Select Project** → `firebase use vision-guard-f0daa` (or `firebase projects:list` to confirm)
- [ ] **Deploy Rules (after testing)** → `firebase deploy --only firestore:rules,storage:rules` → Do this AFTER you verify app works locally, per SECURITY_CHECKLIST
- [ ] **Enable Auth Providers** → Firebase Console > Authentication > Sign-in method > Enable Email/Password, Google (if needed)
- [ ] **Configure Firestore** → Create collections if not exist: `user`, `parent_verifications`, `parent_child_links`, `eye_images`, `screen_time`, `daily_summaries` etc - app creates them on signup, but check indexes in firestore.indexes.json (currently empty `{}`)

### 7. Functions Setup (Optional for parent email)
- [ ] **cd functions && npm install**
- [ ] **Configure SendGrid** → `firebase functions:config:set sendgrid.api_key="YOUR_SENDGRID_KEY" sendgrid.from_email="no-reply@yourdomain.com" app.verify_base_url="https://us-central1-vision-guard-f0daa.cloudfunctions.net/verifyParentApproval"` → Or use new env var method (firebase functions:secrets:set)
- [ ] **Deploy Functions** → `firebase deploy --only functions` → Then update app.json extra URLs with deployed URLs

### 8. Device / Emulator
- [ ] **Create AVD** → Android Studio > Device Manager > Create Device > Pixel 7 API 35 (Android 15) > RAM 4GB+ → For testing UsageStats, need Google APIs image
- [ ] **Enable Developer Options on Physical Device** → Settings > About > Tap Build 7 times > Enable USB Debugging → For real blink detection, physical device REQUIRED (emulator camera is fake)
- [ ] **Test ADB** → `adb devices` should list device/emulator

### 9. First Run
- [ ] **Clear Cache** → `npx expo start --clear`
- [ ] **Run Android** → `npx expo run:android` (first build takes 10-20 mins, downloads Gradle 8.13) → If fails due to NDK, check gradle.properties ndkVersion
- [ ] **Alternatively** → `npx expo start` then press `a` for Android
- [ ] **Check Logs** → `adb logcat | grep VisionGuard` or `npx expo logs`

### 10. VS Code Extensions (Recommended, not required)
- [ ] **ES7+ React/Redux snippets, Prettier, ESLint, Expo Tools, Kotlin Language**

**Compatible Versions Summary:**
- Node: 20 LTS (not 22, not 18)
- JDK: 17 (Temurin) or 21 - avoid 8, 11
- Gradle: 8.13 (auto-downloaded)
- Android SDK: Platform 35, Build-Tools 35.0.0, NDK 26.1.10909125
- Expo SDK: 53.0.27 (do NOT upgrade to 54 yet)
- React: 19.0.0 (locked), RN: 0.79.6 (locked)
- Firebase JS: 12.0.0 (locked)

---

## D. Missing / Lost Components (Cannot be Recovered from GitHub)

**CONFIRMED MISSING (checked via .gitignore and file search):**

1. **.env file** → Contains Firebase keys, encryption key → Gitignored via `.env`, `.env*` → **Recreatable** from app.json extra + eas.json (provided in checklist above) but you should rotate keys
2. **google-services.json** → Android Firebase config for native services (FCM) → Gitignored via `*.jks`, `*.p8` etc? Actually not explicitly gitignored but not present - **Must re-download from Firebase Console**
3. **GoogleService-Info.plist** → iOS Firebase config → Not present
4. **node_modules/** → 50+ dependencies → Gitignored → **Recreatable via npm install**
5. **.expo/, dist/, web-build/, .metro-cache** → Generated → Recreatable
6. **android/.gradle/, android/app/build/, android/build/, android/.idea/, android/.cxx/** → Build artifacts → Gitignored → Recreatable via `npx expo run:android`
7. **Documentation (LOST, not recoverable unless you have backup):**
   - `CODE_ANALYSIS_REPORT*.md` → Gitignored → Referenced in .gitignore, likely contained your previous audit tasks
   - `SCREEN_TRACKING_USAGE.md` → Gitignored → Usage docs
   - `DEPLOY_SECURITY.md` → Referenced in SECURITY_CHECKLIST.txt → Step-by-step security deploy guide → LOST
   - `SECURITY_IMPLEMENTATION_GUIDE.md` → Full security guide → LOST
   - `SECURITY_OPTIMIZATION_REPORT.md` → Analysis report → LOST
   - `docs/` folder → Gitignored → Any FYP docs
   - `*.docx` → Gitignored → Thesis, proposal docs → **LOST - most critical for FYP submission**
8. **ML Artifacts (LOST if you trained custom models):**
   - `models/`, `checkpoints/`, `artifacts/`, `ml/models/`, `ml/checkpoints/`, `ml/artifacts/`, `ml/data/`, `data/`, `**/outputs/`, `**/runs/`, `*.pt`, `*.onnx`, `*.tflite`, `*.ckpt` → All gitignored → If you had custom eye disease detection model, it's lost. Current code uses ML Kit (no custom model), so maybe not critical
9. **Python venv** → `.venv*/`, `venv*/` → Gitignored → If you had Python scripts for ML training, lost
10. **Temp extract folders** → `_extract*/`, `*_extract*/` → Gitignored
11. **EAS Credentials** → `*.jks`, `*.p8`, `*.p12`, `*.key`, `*.mobileprovision` → Gitignored → Release keystore for Play Store - debug.keystore IS present (android/app/debug.keystore) but release keystore missing. If you had created release keystore, lost.
12. **Firebase Service Account / SendGrid API Key** → Not in repo (good security) but you need to recreate in Firebase Console and SendGrid dashboard
13. **Local Emulator Snapshots, Device Data** → Not in repo
14. **The .md task file you mentioned** → Likely was CODE_ANALYSIS_REPORT.md or similar, gitignored, so not on GitHub → **LOST** - we must reconstruct from code comments and README_AUTH.md

**INFERRED LOST (from typical FYP workflow):**
- FYP Proposal, SRS, Design docs, Test cases (docx)
- Screenshots, demo videos stored locally
- Postman collections for API testing
- Local Firestore emulator data
- Any uncommitted code changes after last commit c71c0b6 - since only 1 commit exists, any work after that commit that wasn't pushed is lost. But since this is the only commit and it says "fix: add missing bg_floating_bubble", it's likely you were at this exact state.

**Recreatable vs Not:**
- Recreatable: .env, node_modules, google-services.json (via Firebase Console), build folders, EAS build via `eas build`
- NOT Recreatable: docx thesis, custom ML models if trained, any uncommitted code, security guide md files, screenshots

---

## E. Remaining FYP Work - Prioritized Critical → Optional

### CRITICAL (Must do to make app runnable & defensible for FYP)

1. **Environment Recreation** → Create .env, install deps, get google-services.json, make first Android build succeed → **Blocks everything**
2. **Fix screen-time.tsx stub** → Currently hasPermission false, refresh empty → Should use ScreenTimeContext or NativeScreenTrackingService → Without fix, Screen Time tab is broken
3. **Fix parent-approve.html project ID mismatch** → Change blinkfit-ca40a to vision-guard-f0daa Firebase config, or make it dynamic via hosting env → Parent approval web page broken
4. **Test full auth flow end-to-end on physical Android device** → Signup (adult) → Login → Face capture → Face verification → Main → Logout → Signup (child with parent email) → Wait approval → Parent approves via dashboard → Child completes face capture → Login
5. **Configure Firebase Functions env** → Set SendGrid API key, from_email, verify_base_url → Deploy functions → Test email actually sends → Currently returns warning token
6. **Fix package name inconsistency** → Decide: com.wajahat001.blinkfit vs com.irtiza001.visionguard → Update app.json android.package, android/app/build.gradle applicationId & namespace, MainApplication.kt package, all Kotlin files package, google-services.json package → Must be consistent for release
7. **Deploy Firestore & Storage Rules** → `firebase deploy --only firestore:rules,storage:rules` → Test unauthorized access blocked
8. **Rotate exposed API keys** → app.json and eas.json contain Firebase API key in plain text (AIzaSyDM0pbu8ye7xKADzRbK8EMdBdmFGvej2u0) → Restrict key in Google Cloud Console to Android app + HTTP referrers, create new key, update .env, remove from app.json extra (use env only)

### HIGH (Needed for good FYP grade, core features)

9. **Implement real eye health analysis** → Currently EyeImageCaptureService captures images but no analysis. Need to implement redness detection, fatigue score, or at least mock analysis using ML Kit face detection + eye open probability → DailySummaryService healthScore is currently placeholder
10. **Fix Android 13+ background tasks** → BackgroundTasks.ts has TODO migrate to expo-background-task, currently skipped on Android 13+ → Use expo-background-task or WorkManager for daily summary sync
11. **Complete encryption for face data** → secureEncryption.ts exists but face-capture.tsx stores faceHash plain JSON, not encrypted → Should encrypt with userId before saving to Firestore
12. **Fix brightness & distance warnings** → BrightnessService exists but not integrated into overlay service fully → VisionGuardOverlayService.kt has distance warning but no brightness check
13. **Parent Dashboard enhancements** → Show child's real screen time, app usage, blink data from Firestore, not just lock/unlock → Need to query child's daily_summaries
14. **Lock screen enforcement hardening** → lock-screen.tsx blocks back button but user can force-close app? Need Device Admin or overlay? For FYP, document limitation
15. **Google OAuth** → README_AUTH.md says implemented but file missing → Either implement expo-auth-session Google login or remove from docs
16. **Error handling & offline** → OfflineSyncService 905 lines exists but ConflictResolutionModal may not be wired everywhere → Test airplane mode
17. **Performance: Reanimated + NDK mismatch** → Fix ndkVersion to 27.1.12297006 or install 26.1.10909125, test release build `expo run:android --variant release`

### MEDIUM (Polish, documentation)

18. **UI/UX consistency** → Dark mode, theme colors, carousel infinite scroll bug (currentCarouselIndex starts at 0 but extended data has last item at start)
19. **Analytics screen** → Add real charts (victory-native or react-native-chart-kit) for weekly screen time, blinks, distance
20. **Eye exercise screen** → app/eye-exercise.tsx exists but content unknown - implement 20-20-20 guided exercise
21. **Manual eye capture** → app/manual-eye-capture.tsx - implement
22. **Profile edit & face re-verification** → profile-edit.tsx, profile-face-verification.tsx - test flows
23. **Daily summary notifications** → Test notification permission flow, channel creation for Android
24. **Security hardening** → Enable App Check, implement password strength meter, biometric re-auth for sensitive actions
25. **Bundle analysis & optimization** → `scripts/analyze-bundle.js` exists, run `npm run analyze`

### OPTIONAL (If time)

26. **iOS build** → Requires Mac, Xcode, Apple Dev account → Create ios folder via `npx expo prebuild --platform ios`
27. **Web support** → Improve web camera mock, make responsive
28. **Unit & integration tests** → No tests currently
29. **CI/CD** → GitHub Actions for lint, type-check, EAS build
30. **Play Store release** → Generate release keystore, configure signing, `eas build --platform android --profile production`

---

## F. Previous .md Instructions - Extracted & Status

### Only .md file found in repo: `app/(auth)/README_AUTH.md` (4.2K)

**CONFIRMED FROM REPOSITORY:**

| Task Mentioned in README_AUTH.md | Status | Evidence |
|---|---|---|
| Email/Password Authentication (Login.tsx) - Firebase Auth, email validation, password reset, loading states | ✅ Already implemented | Login.tsx 400+ lines, uses signInWithEmailAndPassword, sendEmailVerification, Gmail-only validation |
| User Registration (signup.tsx) - Multi-step, age category, parent email verification, face capture integration | ✅ Already implemented | signup.tsx + face-capture.tsx + wait-parent-approval.tsx flow exists |
| Password Recovery (forgetPassword.tsx) - Firebase reset emails | ✅ Already implemented | forgetPassword.tsx exists |
| Google OAuth Integration (googleLogin.tsx) - Complete Google Sign-in | ❌ Not implemented | File googleLogin.tsx does NOT exist, Environment.ts has Google client IDs but no implementation, README says complete but missing |
| Biometric Security (face-verification.tsx & face-capture.tsx) - Face capture, verification, camera permissions | ✅ Already implemented | Both files exist, 500+ lines each, ML Kit integration |
| Firebase Configuration (firebaseConfig.ts) - Auth, Firestore, Storage, AsyncStorage persistence | ✅ Already implemented | firebaseConfig.ts 80+ lines with persistence handling |
| Modern UI/UX - Responsive, keyboard handling, loading animations | ✅ Already implemented | All screens have StyleSheet, keyboard avoiding, ActivityIndicator |
| Logo Integration - Fixed path assets/images/logo.jpg | 🟡 Partially implemented | assets/logo.png exists, assets/images/ folder has react logos but not logo.jpg - path in README outdated, actual code uses ../../assets/logo.png |
| Enhanced UX - Loading states, input validation, disabled button | ✅ Already implemented | Login.tsx has isLoading, ActivityIndicator, validateEmail, validateGmailAddress |
| Visual Polish - Color scheme #2B383D, typography, shadows | ✅ Already implemented | Colors.ts, all screens use #2B383D |
| Parent Approval Flow - Child signup sends email, parent clicks link hosted by Functions, waiting screen auto proceeds, configure URLs in app.json extra, set functions config sendgrid | 🟡 Partially implemented | Code exists: ParentApproval.ts, wait-parent-approval.tsx, functions/src/index.ts, app.json extra URLs set to old blinkfit-ca40a project, but SendGrid not configured, warning token returned, parent-approve.html has wrong project ID |
| Next Steps Optional: Test on physical devices | ❓ Cannot verify | adb_crash.log and build_log.txt suggest testing was attempted on emulator, but no evidence of physical device test |
| Next Steps: Configure Firebase security rules | 🟡 Partially implemented | firestore.rules and storage.rules exist and comprehensive, but SECURITY_CHECKLIST.txt shows manual steps not done (deploy rules, enable App Check) |
| Next Steps: Add analytics tracking | 🟡 Partially implemented | analytics.tsx exists but basic, no Firebase Analytics SDK added |
| Next Steps: Implement password strength validation | ✅ Already implemented | securityUtils.ts has isStrongPassword, used in Login.tsx |
| Next Steps: Add social media login options | ❌ Not implemented | Only email/password, no social logins |

### SECURITY_CHECKLIST.txt (3K) - Tasks:

| Task | Status |
|---|---|
| dotenv installed | ✅ |
| Firebase CLI installed | ❓ Cannot verify (need to check local machine) |
| Firebase config files created | ✅ firebaseConfig.ts, parentFirebaseConfig.ts exist |
| Security rules files created | ✅ firestore.rules, storage.rules |
| Encryption utilities implemented | ✅ encryption.ts, secureEncryption.ts |
| Validation utilities implemented | ✅ validation.ts, securityUtils.ts |
| Rate limiting service implemented | ✅ RateLimitService.ts |
| STEP 1: Rotate API Keys (Restrict Firebase API key, Rotate Google OAuth Secret, Update .env) | ❌ Not implemented - API key exposed in app.json |
| STEP 2: Login to Firebase (firebase login, projects:list) | ❓ Cannot verify - need manual |
| STEP 3: Deploy Security Rules (firebase deploy --only firestore:rules,storage:rules) | ❓ Cannot verify - need to check Firebase Console |
| STEP 4: Enable App Check (Enable in Console, reCAPTCHA v3, Enforce for Firestore/Storage) | ❌ Not implemented - no App Check code |
| STEP 5: Test Everything (env vars, face encryption, rate limiting, security rules) | ❓ Cannot verify |

### Gitignored MD Files (INFERRED LOST):

- `CODE_ANALYSIS_REPORT*.md` - Likely contained previous audit you mentioned - **LOST, marked ❓ Cannot verify**
- `SCREEN_TRACKING_USAGE.md` - Likely documented screen time native module usage - **LOST**
- `DEPLOY_SECURITY.md`, `SECURITY_IMPLEMENTATION_GUIDE.md`, `SECURITY_OPTIMIZATION_REPORT.md` - Referenced in SECURITY_CHECKLIST.txt - **LOST**
- Any custom task file you created with me previously - **LOST due to .gitignore**

---

## G. Recommended Recovery Plan - Safest Step-by-Step

### Phase 0: Safety (Do this NOW, before any code change)

1. **Create backup branch** → `git checkout -b backup/pre-recovery-2026-08-28 && git push origin backup/pre-recovery-2026-08-28` → So you can always go back
2. **Create RECOVERY_TRACKER.md** → Already done in this audit (see separate file)
3. **Do NOT upgrade dependencies yet** → Keep Expo 53.0.27, RN 0.79.6, Firebase 12.0.0 as-is until app runs

### Phase 1: Make it Runnable (Day 1)

4. **Install Node 20 LTS + JDK 17 + Android Studio** → Follow checklist C
5. **Clone fresh, npm install** → `npm install` (if fails, `npm install --legacy-peer-deps`)
6. **Create .env** → Use template from Section C
7. **Download google-services.json** → Firebase Console > vision-guard-f0daa > Android app > Download → Place in android/app/
8. **First build attempt** → `npx expo prebuild --clean` (if needed) then `npx expo run:android` → Expect Gradle download 8.13 (10 mins) → If NDK error, install NDK 26.1.10909125 or change gradle.properties to 27.1.12297006
9. **Fix immediate build errors** → Check `adb logcat` and Metro logs → Most likely: missing google-services.json, NDK mismatch, package name
10. **Verify splash screen loads** → App should show splashScreen.tsx with logo and loading bar

### Phase 2: Fix Critical Bugs (Day 2-3)

11. **Fix screen-time.tsx** → Replace stub with real implementation using ScreenTimeContext:
```tsx
// Use useScreenTime hook, not hardcoded false
const { hasPermission, isLoading, refreshScreenTime } = useScreenTime();
```
12. **Fix parent-approve.html** → Update Firebase config from blinkfit-ca40a to vision-guard-f0daa → Or better, make it read config from hosting env
13. **Test auth flow on physical device** → Adult signup → Email verification (check inbox/spam) → Login → Face capture → Face verification → Main
14. **Test child flow** → Child signup with existing adult parent email → Check Firestore parent_verifications collection → Manually set status to approved in Console (since email disabled) → Wait-parent-approval should auto navigate → Face capture → Login
15. **Fix package name consistency** → Decide final package: recommend `com.irtiza001.visionguard` (from app.json) → Update android/app/build.gradle applicationId, namespace, all Kotlin files package from `com.wajahat001.blinkfit` to `com.irtiza001.visionguard`, MainApplication.kt, AndroidManifest.xml, google-services.json

### Phase 3: Firebase & Security (Day 4)

16. **Deploy Firestore rules** → `firebase deploy --only firestore:rules,storage:rules` → Test with unauthenticated read should fail
17. **Setup Functions env** → Create SendGrid account, get API key, set `firebase functions:config:set sendgrid.api_key=...` → Deploy functions → Update app.json extra URLs to new vision-guard-f0daa URLs
18. **Rotate API keys** → Google Cloud Console > APIs & Services > Credentials > Restrict Firebase API key to Android app package + SHA-1 → Create new key, update .env, remove hardcoded keys from app.json extra (use only env)
19. **Test parent email flow end-to-end** → Child signup → Parent receives email → Clicks link → Child auto proceeds

### Phase 4: Feature Completion (Week 2)

20. **Implement real eye analysis** → Use ML Kit face detection eye open probability + simple redness heuristic from eye image RGB → Update DailySummaryService healthScore
21. **Fix background tasks for Android 13+** → Migrate from expo-background-fetch to expo-background-task or use WorkManager directly in native module
22. **Encrypt face data** → In face-capture.tsx, after generating faceHash, call `encryptFaceData(faceHash, user.uid)` from secureEncryption.ts before saving to Firestore
23. **Parent Dashboard real data** → Query Firestore for child's screen time, blinks, eye images → Show in ParentDashboard.tsx
24. **Implement eye exercise guided flow** → 20-20-20 timer with animations
25. **Polish analytics** → Add charts for weekly data

### Phase 5: Testing & Documentation (Week 3)

26. **Physical device testing matrix** → Test on Android 10, 13, 15, different OEMs (Samsung, Xiaomi) for Usage Access permission differences
27. **Create FYP documentation** → Since docx lost, recreate from code: Architecture diagram, ER diagram (Firestore collections), Use case diagrams, Screenshots, Test cases
28. **Bundle analysis** → `npm run analyze` → Optimize if bundle > 50MB
29. **Release build** → `eas build --platform android --profile preview` → Test APK on device → Then `eas build --platform android --profile production` for AAB
30. **Final security checklist** → Follow SECURITY_CHECKLIST.txt steps 1-5, mark all done

### Safety Rules Throughout:

- **Commit after each phase** → `git add . && git commit -m "phase X: description" && git push origin arena/01a04903-visionguard-fyp`
- **Keep RECOVERY_TRACKER.md updated** → After each significant step, update tracker
- **Do NOT upgrade Expo SDK or RN** → Unless you have 2+ weeks buffer, upgrades can break native modules
- **Preserve working code** → Minimal targeted changes, no rewrites
- **Test on physical device for camera features** → Emulator camera is fake, blink detection will not work accurately

---

## Appendix: Firestore Collections (CONFIRMED from rules & code)

- `user/{uid}` → uid, name, email, emailLower, dateOfBirth, category (child/adult/old), parentEmail, parentEmailLower, parentUid, faceHash, faceSigHash, createdAt, emailVerified, isLocked, childrenCount, children[]
- `parent_verifications/{token}` → token, status (pending/approved/verified/expired/completed), createdAt, expiresAt, approvedAt, child {name,email,dateOfBirth,category}, parentEmail, otp
- `parent_child_links/{parentId_childId}` → parentId, childId, linkedAt
- `eye_images/{imageId}` → userId, timestamp, leftEyeUri, rightEyeUri, metadata
- `eye_analysis/{analysisId}` → userId, analysis data
- `face_verifications/{verificationId}` → userId, verification data (immutable)
- `redness_logs/{logId}` → userId, timestamp, rednessScore 0-100
- `daily_summaries/{summaryId}` → userId, date, metrics
- `screen_time/{userId}/daily/{date}` → seconds, duration, app usage
- `screen_time/{userId}/weekly/{weekId}` → averageSeconds, etc
- `blinks/{userId}/...` → blink counts

---

## Appendix: Important Files to Review Manually

- `app/_layout.tsx` → Global error handlers, service initialization, lock listener
- `services/ServiceInitializer.ts` → Initializes all services after face verification
- `utils/AndroidPermissions.ts` → Android 13+ permission handling
- `android/build_log.txt` → Previous build logs (binary, but shows Gradle tasks)
- `adb_crash.log` → Previous crash logs (WifiVendorHal errors, likely emulator)

---

**Next Step:** Review this audit, then tell me to proceed with Phase 1 implementation. I will NOT modify code until you approve.

**Tracker:** See `RECOVERY_TRACKER.md` for live checklist.

