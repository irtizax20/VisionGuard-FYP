# VisionGuard - FILE INDEX (All Files Explained)
**Reconstructed 2026-08-28**

## Root Files

| File | Purpose | Status |
|------|---------|--------|
| `package.json` | Dependencies: Expo 53.0.27, RN 0.79.6, Firebase 12.0.0, ML Kit | ✅ |
| `app.json` | Expo config: name Vision Guard, slug visionguard, package com.irtiza001.visionguard, extra Firebase keys (exposed!) | 🟡 Keys exposed |
| `app.config.js` | Dynamic config: merges app.json + .env via dotenv, adds datetimepicker plugin | ✅ |
| `eas.json` | EAS Build: cli >=16.17.0, profiles development/preview/production, preview has Firebase env | ✅ |
| `firebase.json` | Hosting + Firestore + Storage config | ✅ |
| `.firebaserc` | Project: vision-guard-f0daa | ✅ |
| `firestore.rules` | 14k lines security rules: user, eye_images, redness_logs, daily_summaries, parent_verifications | ✅ Comprehensive |
| `storage.rules` | Storage rules | ✅ |
| `SECURITY_CHECKLIST.txt` | Manual steps: rotate keys, login firebase, deploy rules, enable App Check | 🟡 Not all done |
| `FYP_RECOVERY_AUDIT.md` | Full audit (new) | ✅ |
| `RECOVERY_TRACKER.md` | Live checklist (new) | ✅ |
| `PENDING_IMPROVEMENTS.md` | Reconstructed tasks (new) | ✅ |

## app/ Directory (Expo Router)

| File | Purpose |
|------|---------|
| `app/_layout.tsx` | Root layout: ErrorBoundary, ThemeProvider, ScreenTimeProvider, Auth state listener, ServiceInitializer, lock listener (onSnapshot isLocked), BackgroundTasks handling (skips Android 13+) |
| `app/index.tsx` | Entry: Redirect to splash, DEV emergency bypass after 5s |
| `app/splash/splashScreen.tsx` | Splash: logo.png, loading bar animation 2s, checks auth.currentUser + AsyncStorage faceVerificationCompleted |
| `app/(auth)/Login.tsx` | Login: Gmail-only validation, rate limiting (5 attempts), email verification check, forces face verification after login |
| `app/(auth)/signup.tsx` | Signup: name, email, password, DOB, category (child/adult/old), parentEmail if child, sends to parent approval |
| `app/(auth)/face-capture.tsx` | Face capture: camera permission, takePictureAsync (quality 0.5, base64), dummy web hack, faceHash JSON, faceSigHash simpleHashHex, duplicate check via Firestore query where faceSigHash==, parent token verification, create Firebase Auth + Firestore user doc |
| `app/(auth)/face-verification.tsx` | Face verification: camera permission every login, ML Kit validation, old format detection (width/height vs embedding), registration vs verification, stores faceVerificationCompleted flag, initializes services |
| `app/(auth)/forgetPassword.tsx` | Password reset via Firebase |
| `app/(auth)/wait-parent-approval.tsx` | Child waiting: onSnapshot parent_verifications token, status pending/approved/expired/invalid, auto navigate to face-capture when approved |
| `app/(auth)/welcome.tsx` | Welcome after face verification |
| `app/(tabs)/_layout.tsx` | Tabs layout |
| `app/(tabs)/Main.tsx` | Home: userName, carousel (20-20-20 tips), eyeHealthTips, permission checks for Usage Access (4 retries then logout) + Battery Optimization, menu items TODO screen time tracker |
| `app/(tabs)/ParentDashboard.tsx` | Parent: list children from user collection where parentUid==, lock/unlock via isLocked field, OTP via getPendingOTPForParent |
| `app/(tabs)/Report.tsx` | Report screen |
| `app/(tabs)/Setting.tsx` | Settings |
| `app/blink-test.tsx` | Blink test: camera permission, startDetection via BlinkDetectionService, countdown, eyeCapture toggle, TTS warnings for too close |
| `app/eye-images-gallery.tsx` | Gallery: EyeImageCaptureService.getAllEyeImages, FlatList, save to gallery via MediaLibrary, clear all |
| `app/screen-time.tsx` | **BROKEN STUB**: hasPermission=false hardcoded, refreshDailyUsage empty - should use ScreenTimeContext |
| `app/analytics.tsx` | Analytics: queries screen_time/{uid}/weekly, blinks, shows WeekData, DayData |
| `app/daily-summary.tsx` | Daily summary |
| `app/eye-exercise.tsx` | Eye exercise (20-20-20) |
| `app/manual-eye-capture.tsx` | Manual eye capture |
| `app/lock-screen.tsx` | Lock screen: blocks back button, listens onSnapshot user.isLocked, redirects when unlocked |
| `app/profile-edit.tsx` | Profile edit |
| `app/profile-face-verification.tsx` | Re-verify face |
| `app/screen-time-details.tsx` | Details |

## android/ Native Modules (Kotlin)

| File | Purpose |
|------|---------|
| `MainApplication.kt` | Registers 6 packages: UsageStats, ScreenTimeTracker, ScreenBreak, BlinkDetection, TTSSettings, VisionGuardOverlay |
| `MainActivity.kt` | Main activity |
| `BlinkDetectionModule.kt` | 32k lines: startDetection, stopDetection, CameraX, ML Kit face detection, eye open classification, distance via face size, eye image capture to directory |
| `BlinkDetectionHelper.kt` | Helper: blink count, average distance, eye openness |
| `UsageStatsModule.kt` | hasUsagePermission via queryUsageStats, requestUsagePermission via ACTION_USAGE_ACCESS_SETTINGS, isSystemApp filter |
| `ScreenTimeTrackerModule.kt` | Native screen time tracking |
| `ScreenBreakModule.kt` | Screen break overlay |
| `ScreenLockView.kt` | Lock view |
| `ScreenStateReceiver.kt` | Screen on/off receiver |
| `ScreenTimeService.kt` | Foreground service dataSync |
| `VisionGuardOverlayModule.kt` + `Service.kt` | Floating bubble, camera foreground service type camera, TTS, throttling: distance 15s, blink 60s, fatigue 20min, blinkCount per minute MIN 8 |
| `TTSSettingsModule.kt` | TTS settings |
| `build.gradle` | Namespace com.wajahat001.blinkfit (mismatch!), dependencies: ML Kit face-detection 16.1.7, CameraX 1.3.1, lifecycle-service 2.6.2, Guava, Coroutines |
| `gradle.properties` | Forces minSdk 24 for Reanimated, ndkVersion 26.1.10909125 |

## services/ (TypeScript)

| Service | Purpose | Lines |
|---------|---------|-------|
| `FaceDetectionService.ts` | Face embedding, verification, ML Kit | 630 |
| `BlinkDetectionService.ts` | Wrapper for native BlinkDetectionModule | |
| `BlinkTrackingService.ts` | Blink tracking logic | 505 |
| `EyeImageCaptureService.ts` | Capture left/right eye, save, gallery | 488 |
| `ScreenTimeSyncService.ts` | Sync screen time to Firestore | 637 |
| `NativeScreenTrackingService.ts` | Wrapper for ScreenTimeTracker + UsageStats | 267 |
| `BackgroundSyncManager.ts` | Background sync settings, stats | 526 |
| `OfflineSyncService.ts` | Offline queue, conflict resolution | 905 |
| `DailySummaryService.ts` | Daily metrics, 8PM notification | 368 |
| `ServiceInitializer.ts` | Initializes all services after face verified | 247 |
| `BiometricAuthService.ts` | Fingerprint (not fully integrated) | |
| `BrightnessService.ts` | Brightness | |
| `CategoryManager.ts` | Age categories under16/16-40/40+ thresholds | 357 |
| `UserManagementService.ts` | getParentUid, updateParentChildCount | 307 |
| `SecureStorageService.ts` | Secure store | 178 |
| `RateLimitService.ts` | Login rate limit 5 attempts | 295 |
| `VisionGuardOverlayService.ts` | Overlay service wrapper | 32 |

## firebase/

| File | Purpose |
|------|---------|
| `firebaseConfig.ts` | Initializes Firebase app, Auth with persistence (web vs RN), Firestore with initializeFirestore |
| `firebaseConfig-backup.ts` | Backup config |
| `parentFirebaseConfig.ts` | Parent verification secondary app |
| `firestorePatch.ts` | Patches |

## functions/

| File | Purpose |
|------|---------|
| `src/index.ts` | requestParentApproval (POST, validates parent age 16+, creates token uuid, 24h expiry, sends SendGrid email) + verifyParentApproval (GET token, checks expiry, marks approved) |
| `package.json` | Node >=18, firebase-admin 12.5.0, functions 5.0.1, sendgrid 8.1.0 |

## Other

| Folder | Purpose |
|--------|---------|
| `components/ScreenTime/` | DailyScreenTimeCard, AppUsageList, WeeklySummary, PermissionCard |
| `contexts/ScreenTimeContext.tsx` | Global screen time: screenTimeSeconds, isTracking, formattedTime, hasPermission, refresh |
| `hooks/` | useAuth, useTheme, ThemeContext, useGlobalScreenTimer |
| `utils/` | ParentApproval, ParentVerification (22+ age check), encryption (CryptoJS AES), secureEncryption (deviceId+appId+userId key), validation, securityUtils, errorHandling, AndroidPermissions |
| `constants/config.ts` | FIREBASE_CONFIG from Constants.expoConfig.extra |
| `public/parent-approve.html` | **BROKEN**: hardcoded blinkfit-ca40a config, should be vision-guard-f0daa |

## Missing (Gitignored & Lost)

- `docs/` - now tracked, contains these 7 files
- `*.docx` - thesis docs, now tracked
- `models/`, `*.pt`, `*.tflite` - ML models, if you had custom eye model, lost
- `CODE_ANALYSIS_REPORT*.md`, `SCREEN_TRACKING_USAGE.md` - old task files, lost, replaced by PENDING_IMPROVEMENTS.md

