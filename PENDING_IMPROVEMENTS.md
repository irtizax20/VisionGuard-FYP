# VisionGuard - Pending Improvements & Tasks
**Reconstructed:** 2026-08-28 (after laptop theft recovery)
**Original file status:** LOST - was gitignored via `CODE_ANALYSIS_REPORT*.md`, `SCREEN_TRACKING_USAGE.md`, `docs/` patterns
**Purpose:** This is the NEW synced replacement for the lost .md task file. This file IS tracked (not gitignored).

> ⚠️ The previous .md file you mentioned cannot be synced from GitHub because `.gitignore` explicitly ignored it:
> ```
> CODE_ANALYSIS_REPORT*.md
> SCREEN_TRACKING_USAGE.md
> docs/
> *.docx
> ```
> GitHub repo has only 1 commit (c71c0b6) - no history of that file. GitHub Issues/PRs are empty. Local `.idea/workspace.xml` shows no task list. So we must reconstruct.

---

## How We Reconstructed This

1. Scanned all `TODO`, `FIXME`, `HACK` comments in code
2. Analyzed `SECURITY_CHECKLIST.txt` references to missing docs
3. Analyzed `README_AUTH.md` "Next Steps"
4. Analyzed broken/stub code (`screen-time.tsx`, `parent-approve.html`, package name mismatch)
5. Analyzed `adb_crash.log` and `build_log.txt` for build errors
6. Inferred typical FYP improvements for eye-health app

**CONFIRMED LOST vs INFERRED:**
- ✅ CONFIRMED: Tasks referenced in code comments are real
- ❓ INFERRED: Other tasks are likely what we discussed before based on code state

---

## 🔴 CRITICAL - Must Fix to Make App Runnable (Blocks FYP Demo)

### 1. Environment & Build (You lost local env)
- [ ] **Create .env** - Was gitignored, lost. Recreate from app.json extra (template in FYP_RECOVERY_AUDIT.md)
- [ ] **Get google-services.json** - Not in repo, download from Firebase Console vision-guard-f0daa
- [ ] **Fix NDK mismatch** - gradle.properties forces 26.1.10909125 but build used 27.1.12297006. Install exact NDK or update gradle.properties
- [ ] **Fix package name** - `com.wajahat001.blinkfit` (native) vs `com.irtiza001.visionguard` (app.json) - choose one, update all Kotlin files + manifest + build.gradle
- [ ] **npm install** - node_modules gitignored, need fresh install (use Node 20 LTS, --legacy-peer-deps for React 19)

### 2. Screen Time Module - Broken Stub
- [ ] **File:** `app/screen-time.tsx` line 15-20 has:
  ```tsx
  const refreshDailyUsage = async () => { };
  const hasPermission = false;
  const isLoading = false;
  ```
  This was TODO placeholder. Should use `useScreenTime()` from `contexts/ScreenTimeContext.tsx` or `NativeScreenTrackingService`
- [ ] **File:** `app/(tabs)/Main.tsx:528` - `// TODO: Add custom screen time tracker here when ready`
- [ ] **Test:** Usage Access permission flow (4 retries then logout) in Main.tsx - needs real device

### 3. Parent Approval Flow - Project ID Mismatch
- [ ] **File:** `public/parent-approve.html` - Firebase config hardcoded to `blinkfit-ca40a` (old project):
  ```js
  apiKey: "AIzaSyAjMg01e7LUVPjFeM3W-1GUQOPe3nPzKhU",
  projectId: "blinkfit-ca40a"
  ```
  Should be `vision-guard-f0daa` (AIzaSyDM0pbu8ye7xKADzRbK8EMdBdmFGvej2u0). This breaks parent approval web page.
- [ ] **File:** `constants/environment.ts` - `getRedirectUri()` returns `https://auth.expo.io/@wajahat001/Blinkfit` - old slug
- [ ] **Functions:** `functions/src/index.ts` - SendGrid not configured, returns warning token. Need `firebase functions:config:set sendgrid.api_key=...`

### 4. Auth Flow End-to-End
- [ ] Test adult signup → email verification → login → face-capture → face-verification → Main
- [ ] Test child signup → parent email validation (22+ years, not child) → wait-parent-approval → parent approves via ParentDashboard → face-capture
- [ ] **Bug:** `face-capture.tsx` web dummy `web_dummy_base64_data_` - face hash not real on web, duplicate detection fails on web
- [ ] **Bug:** Quality check disabled (`checkImageQuality` always passes) - you disabled for laptop camera low light, need to re-enable with better threshold for final FYP

---

## 🟠 HIGH - Needed for Good FYP Grade

### 5. Security Hardening (from SECURITY_CHECKLIST.txt)
- [ ] **Rotate exposed API key** - `app.json` extra has `AIzaSyDM0pbu8ye7xKADzRbK8EMdBdmFGvej2u0` in plain text, also in `eas.json` preview env. Restrict in Google Cloud Console.
- [ ] **Deploy rules** - `firebase deploy --only firestore:rules,storage:rules` - checklist shows not done
- [ ] **App Check** - Enable in Firebase Console + reCAPTCHA v3 + enforce for Firestore/Storage (from checklist Step 4)
- [ ] **Encrypt face data** - `utils/secureEncryption.ts` exists (generates key from deviceId+appId+userId SHA256) but `face-capture.tsx` stores `faceHash` plain JSON:
  ```ts
  faceHash, // Face data (plain text) - should be encrypted
  ```
  Should be `await encryptFaceData(faceHash, user.uid)`
- [ ] **Password strength** - `securityUtils.ts` has `isStrongPassword` but not enforced in signup.tsx? Check

### 6. Eye Health AI - Currently Placeholder
- [ ] **EyeImageCaptureService.ts** captures left/right eye images but no analysis. `DailySummaryService.ts` healthScore is basic. Need real analysis:
  - Redness detection via RGB histogram
  - Blink rate analysis (MIN_BLINKS_PER_MINUTE = 8 in VisionGuardOverlayService.kt)
  - Screen distance via ML Kit face size → distance formula
- [ ] **DailySummaryService** - Schedules 8PM notification but `estimatedBlinks`, `eyeStrainEvents` are not calculated from real data
- [ ] **Report.tsx / analytics.tsx** - Shows weekly averages but no charts. Add `victory-native` or `react-native-chart-kit`

### 7. Background Tasks - Android 13+ Broken
- [ ] **File:** `services/BackgroundTasks.ts:6` - `// TODO: Migrate to expo-background-task`
- [ ] **File:** `app/_layout.tsx` - Skips BackgroundTasks on Android 13+:
  ```ts
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    require('../services/BackgroundTasks');
  } else {
    console.log('Skipping BackgroundTasks (deprecated)');
  }
  ```
  Need migration to `expo-background-task` or WorkManager native
- [ ] **File:** `services/BackgroundSyncManager.ts:231` - `// TODO: Add expo-battery package`

### 8. Parent Dashboard Real Data
- [ ] **File:** `app/(tabs)/ParentDashboard.tsx` - Shows children list, lock/unlock via `isLocked` field, OTP display via `getPendingOTPForParent`. But does NOT show child's real screen time, app usage, blink data. Need to query:
  - `screen_time/{childId}/daily/{date}`
  - `daily_summaries/{childId}`
  - `eye_images/{childId}`
- [ ] **Lock Screen** - `app/lock-screen.tsx` blocks back button but can be force-closed? Document limitation for FYP or implement Device Admin

### 9. Package Consistency & Build
- [ ] Update all package references from `com.wajahat001.blinkfit` to `com.irtiza001.visionguard` (or vice versa):
  - `android/app/build.gradle` applicationId + namespace
  - `android/app/src/main/AndroidManifest.xml`
  - All 12 Kotlin files package declaration
  - `app.json` android.package
  - `google-services.json` package
  - `MainApplication.kt`, `MainActivity.kt`
- [ ] Test release build: `npx expo run:android --variant release` - Reanimated + NDK mismatch causes C++ linking errors

---

## 🟡 MEDIUM - Polish & FYP Documentation

### 10. UI/UX Fixes
- [ ] **Carousel** in `Main.tsx` - infinite scroll: `currentCarouselIndex` starts at 0 but `extendedCarouselData` has last item duplicated at start, first at end. Logic for `onMomentumScrollEnd` may jump
- [ ] **Dark mode** - `Colors.ts` has light/dark but some screens hardcode `#2B383D`
- [ ] **Eye Exercise** - `app/eye-exercise.tsx` exists but content unknown, implement 20-20-20 guided timer with animations
- [ ] **Manual Eye Capture** - `app/manual-eye-capture.tsx` - implement
- [ ] **Profile Edit** - `app/profile-edit.tsx`, `profile-face-verification.tsx` - test flows

### 11. Offline & Sync
- [ ] **OfflineSyncService.ts** 905 lines - ConflictResolutionModal exists but not wired everywhere. Test airplane mode
- [ ] **ScreenTimeSyncService.ts** - Syncs screen time to Firestore, need to handle conflicts

### 12. Google OAuth (Mentioned but Missing)
- [ ] **README_AUTH.md** says Google OAuth implemented but `app/(auth)/googleLogin.tsx` file does NOT exist
- [ ] **Environment.ts** has Google client IDs: `969589250918-sl8432rau67ken8rqnvurkcpkscf1og7` - but no auth session implementation
- [ ] Either implement `expo-auth-session` Google login or remove from docs

### 13. FYP Documentation (LOST - Must Recreate)
- [ ] **Thesis docx** - Was gitignored `*.docx`, lost. Recreate: Introduction, Literature Review, Methodology, Implementation, Testing, Results, Conclusion
- [ ] **Diagrams** - ER diagram (Firestore collections: user, parent_verifications, parent_child_links, eye_images, screen_time, daily_summaries, blinks, redness_logs), Architecture (Expo + Firebase + Native Modules), Use Case (Child, Parent, Admin)
- [ ] **Screenshots** - Auth flow, Main carousel, Blink test, Eye gallery, Screen time, Parent dashboard, Lock screen, Daily summary, Report, Analytics
- [ ] **Test Cases** - Unit (validation), Integration (auth + face), System (screen time tracking), UAT
- [ ] **Bundle Analysis** - `scripts/analyze-bundle.js` exists, run `npm run analyze`

---

## 🟢 OPTIONAL - If Time

- [ ] iOS build - `npx expo prebuild --platform ios` requires Mac + Xcode
- [ ] Web support - Improve web camera mock, responsive
- [ ] Unit tests - No tests currently
- [ ] CI/CD - GitHub Actions for lint + type-check + EAS build
- [ ] Play Store release - Generate release keystore, `eas build --platform android --profile production` AAB

---

## Previous Session Tasks - What We Likely Discussed Before

Based on code state and typical FYP iterations, these were probably in your lost .md file:

1. **"Fix bg_floating_bubble drawable missing"** - DONE (last commit c71c0b6 did this)
2. **"Remove unused imports"** - DONE (same commit)
3. **"Screen time tracker custom implementation"** - TODO still open (Main.tsx:528)
4. **"Migrate background-fetch to background-task"** - TODO still open (BackgroundTasks.ts:6)
5. **"Add battery check"** - TODO still open (BackgroundSyncManager.ts:231)
6. **"Implement eye image gallery save to gallery"** - DONE (EyeImageCaptureService has saveToGallery)
7. **"Fix web camera hang"** - DONE with dummy hack (face-capture.tsx web mock)
8. **"Disable quality check for laptop cameras"** - DONE (checkImageQuality always passes, commented out strict check)
9. **"Parent approval email flow"** - Partial (functions implemented but SendGrid not configured)
10. **"Security checklist deployment"** - Partial (rules created but not deployed, keys not rotated)

---

## Sync Strategy Going Forward

**To prevent losing tasks again:**

1. **This file `PENDING_IMPROVEMENTS.md` is TRACKED** - Not in .gitignore, will be pushed to GitHub
2. **Update `.gitignore`** - Remove `CODE_ANALYSIS_REPORT*.md` and `SCREEN_TRACKING_USAGE.md` from ignore list so future reports are tracked. Keep `*.docx` ignored? Actually for FYP you WANT docx tracked, so remove `*.docx` from gitignore too, or create `docs/` folder that IS tracked
3. **Commit often** - After each task completion: `git add . && git commit -m "fix: ..." && git push origin arena/01a04903-visionguard-fyp`
4. **Use GitHub Issues** - For better tracking, create GitHub issues for each critical bug
5. **Backup docs** - Keep thesis docx in Google Drive + GitHub (if you remove from gitignore)

**Proposed .gitignore fix:**
```diff
- *.docx
- CODE_ANALYSIS_REPORT*.md
- SCREEN_TRACKING_USAGE.md
- docs/
+ # Keep docs tracked for FYP
+ # docs/  <-- remove this
```

---

## Checklist Format for Tracking

Use this format when updating this file:

- [ ] Task description - File: `path/to/file.ts:line`
- [x] Completed task - Commit: `abc123`

---

**Last Updated:** 2026-08-28
**Next Action:** Review this file, tell me which section to start with. I recommend Phase 1 (make runnable) first.
