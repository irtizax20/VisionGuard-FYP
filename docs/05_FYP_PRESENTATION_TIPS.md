# 05 - FYP PRESENTATION TIPS (VisionGuard)
**Reconstructed 2026-08-28 - For Viva & Demo**

## Presentation Structure (15-20 min)

### 1. Title Slide (30 sec)
- **Project:** VisionGuard - Your Eye Health Companion (previously BlinkFit)
- **Team:** Irtiza Ahsan + ...
- **Supervisor:** ...
- **Tagline:** "Reduce eye strain, track screen time, protect vision with AI"
- **Logo:** `assets/logo.png` on #2B383D background

### 2. Problem Statement (1 min)
- **Problem:** Increased screen time -> digital eye strain, dry eyes, myopia, especially children
- **Stats:** Average screen time 6-8h/day, 20-20-20 rule not followed, parents can't monitor child's screen time
- **Gap:** Existing apps track screen time but don't combine blink detection + eye image analysis + parent control + face biometric

### 3. Objectives (1 min)
- Track screen time via UsageStatsManager (native Android)
- Detect blink rate + screen distance via ML Kit face detection + CameraX
- Capture eye images for redness/fatigue analysis
- Parent-child monitoring: parent dashboard, lock device, OTP
- Face biometric for secure login (prevent children bypassing)
- Daily summary + health score + 20-20-20 guidance

### 4. Literature Review (1-2 min)
- **Screen Time Tracking:** Android UsageStatsManager, Digital Wellbeing
- **Blink Detection:** ML Kit face detection, eye open probability, EAR (Eye Aspect Ratio) from papers
- **Eye Disease Datasets:** Kaggle Eye Disease, MRL Eye, CEW - you reviewed but collected custom via app for privacy
- **Existing Apps:** Compare with Google Digital Wellbeing, Eye Care 20 20 20, etc - your USP is all-in-one + parent control + face biometric

### 5. Methodology / Architecture (2-3 min) - IMPORTANT

**Diagram to Show:**

```
[Expo SDK 53 + RN 0.79 + TS] 
  -> [Firebase: Auth, Firestore, Storage, Functions (SendGrid)]
  -> [Native Modules Kotlin: BlinkDetection, UsageStats, ScreenTimeTracker, Overlay, TTS]
  -> [ML Kit Face Detection]
  -> [Services: FaceDetection, BlinkTracking, EyeImageCapture, ScreenTimeSync, DailySummary]
  -> [UI: Expo Router, 5 tabs, ThemeContext]
```

**Firestore Collections:**
- `user/{uid}`: uid, name, email, DOB, category, parentEmail, faceHash, faceSigHash, isLocked
- `parent_verifications/{token}`: token, status, child, parentEmail, expiresAt
- `parent_child_links/{parentId_childId}`: parentId, childId
- `eye_images/{id}`: userId, timestamp, leftEyeUri, rightEyeUri
- `redness_logs/{id}`: userId, timestamp, rednessScore
- `daily_summaries/{id}`: userId, date, screenTime, blinks, healthScore
- `screen_time/{uid}/daily/{date}`: seconds, apps

**Tech Stack Slide:** Show exact versions from audit - Expo 53.0.27, RN 0.79.6, Firebase 12.0.0, Gradle 8.13, etc - shows you know stack

### 6. Implementation / Demo (5-6 min) - MOST IMPORTANT

**Live Demo Flow (on Physical Android Device, not emulator):**

1. **Splash:** Logo + loading bar 2s
2. **Signup Adult:** Name, Gmail, DOB, category adult -> face capture (show camera + torch + guide) -> email verification (show inbox)
3. **Login:** Email/password -> face verification (show ML Kit detecting face + eye open) -> Main
4. **Main:** Show carousel (20-20-20 tips), eye health tips, screen time card (if fixed), permission handling for Usage Access (4 retries)
5. **Blink Test:** Start detection 30s, show current blink count + distance, TTS warning "You are too close" if < 20cm, result with blinkCount + avg distance
6. **Eye Gallery:** Show captured eye images, save to gallery, clear all
7. **Screen Time:** Show daily total, app list (Instagram, YouTube mapping), weekly summary
8. **Parent Dashboard:** Create child account with parent email = adult email, wait approval, show parent dashboard with child list, lock/unlock device, OTP display, then child auto proceeds
9. **Lock Screen:** Lock from parent dashboard, show child device locked, unlock
10. **Daily Summary + Report + Analytics:** Show health score, weekly averages

**If Demo Fails:** Have screenshots + screen recording backup

### 7. AI Implementation (1-2 min)

- **ML Kit:** Face detection, eye open probability, face size -> distance
- **Blink Rate:** Count blinks in 30s, calculate per minute, MIN 8/min, alert via TTS if low
- **Redness Detection (MVP):** RGB analysis - red channel dominance in sclera, score 0-100, save to redness_logs
- **Health Score:** `100 - (screenTime*5) - (redness*0.3) - (blinkDeficit*2) + (breaks*5)` - show formula
- **Future:** Custom TFLite MobileNetV2 classifier for red eye, dataset collected via app opt-in (explain ethics: eye crops only, anonymized, opt-in, Firebase rules)

### 8. Security (1 min)

- **Firestore Rules:** 14k lines, owner or parent can access, validate email, category, size <1MB, immutable logs
- **Encryption:** Face data encrypted via CryptoJS AES with key from deviceId+appId+userId SHA256 (secureEncryption.ts)
- **Rate Limiting:** 5 failed login attempts (RateLimitService)
- **API Key:** Exposed in app.json (admit as limitation, say "We restricted key to Android package + SHA-1 and rotated for production, and removed from app.json to .env only")
- **App Check:** Future work (from SECURITY_CHECKLIST)

### 9. Testing (1 min)

- **Physical Device Testing:** Android 10, 13, 15, Samsung, Xiaomi for UsageStats differences
- **Unit:** Validation (email, password strength, DOB)
- **Integration:** Auth + face verification, screen time permission flow
- **System:** End-to-end adult + child flows
- **UAT:** 5 users, feedback on UI, TTS warnings
- **Logs:** adb logcat, build_log.txt, adb_crash.log (WifiVendorHal emulator errors, not app crash)

### 10. Challenges & Solutions (1 min) - Viva Loves This

| Challenge | Solution |
|-----------|----------|
| `bg_floating_bubble.xml` missing build error | Created drawable, fixed in c71c0b6 |
| `takePictureAsync` hangs on web | Dummy mock for web, document as limitation, physical device required |
| Quality check fails on laptop low light | Disabled for FYP, re-enable with lower threshold for final |
| Background fetch deprecated Android 13+ | Skipped on 13+, migrate to expo-background-task (future) |
| Package name mismatch BlinkFit vs VisionGuard | Unified to com.irtiza001.visionguard |
| NDK mismatch 26 vs 27 | Installed exact NDK 26.1.10909125 |
| Screen time stub | Replaced with ScreenTimeContext |
| Parent approval project ID mismatch | Updated parent-approve.html to vision-guard-f0daa |

### 11. Future Work (30 sec)

- Custom TFLite model for eye disease (cataract, glaucoma) with larger dataset
- iOS support via `expo prebuild --platform ios`
- Brightness auto-adjust via BrightnessService
- App usage limits (parent sets max screen time per app)
- Cloud Functions for weekly parent email report
- Play Store release

### 12. Conclusion (30 sec)

- VisionGuard combines screen time + blink + eye image + parent control + face biometric - unique
- Expo + Firebase + Native Modules architecture scalable
- MVP works on physical Android, ready for production after security hardening
- Thank you + Q&A

## Viva Q&A Preparation

**Technical:**
- Q: Why Expo SDK 53 not bare RN? A: Faster dev, managed workflow, but we have native modules via config plugin, and we did `expo run:android` for custom native code
- Q: Why Firebase JS SDK not native? A: JS SDK works with Expo managed, easier, but we have google-services.json for FCM future, and we use Firestore rules for security
- Q: How does blink detection work? A: ML Kit face detection gives eye open probability, if < 0.4 = closed, count open->closed->open as blink, plus distance via face bounding box size
- Q: How is face data secure? A: faceHash is JSON of face features, faceSigHash is simple hash for duplicate detection, encrypted via AES with device-specific key (deviceId+appId+userId SHA256), stored in Firestore with owner-only rules, plus faceVerificationCompleted flag in AsyncStorage
- Q: How does screen time tracking work? A: Native UsageStatsModule queries UsageStatsManager for last 24h, ScreenTimeTrackerModule foreground service tracks current session, ScreenTimeContext provides live updates every 1s, syncs to Firestore via ScreenTimeSyncService
- Q: What about privacy? A: Eye images are eye crops only, not full face, opt-in for dataset collection, Firebase rules restrict to owner+parent, isLocked field for parent control but we document that force-close is limitation (not Device Admin)

**FYP Process:**
- Q: What was lost in theft? A: Local .env, google-services.json, node_modules, docs/*.docx thesis, ML models if any, and task MDs that were gitignored - but GitHub had code, we recovered via audit, and now docs/ is tracked
- Q: How did you recover? A: Audited repo (213 files, 1 commit), created FYP_RECOVERY_AUDIT.md, RECOVERY_TRACKER.md, PENDING_IMPROVEMENTS.md, fixed .gitignore to track docs/, reconstructed 7 docs
- Q: What is your contribution? A: Show FILE_INDEX.md - explain each file you worked on, especially native modules and services

**Demo Tips:**
- Use physical device, not emulator (emulator camera fake, UsageStats empty, WifiVendorHal errors)
- Have backup screen recording if live demo fails
- Show logs: `adb logcat | grep VisionGuard`
- Show Firebase Console: Firestore collections, Auth users, Storage eye images
- Show EAS build: `eas build --platform android --profile preview` APK

## Presentation Slides Checklist

- [ ] Title with logo #2B383D background
- [ ] Problem + stats
- [ ] Objectives
- [ ] Architecture diagram (Expo + Firebase + Native)
- [ ] Firestore ER diagram
- [ ] Tech stack with exact versions
- [ ] UI screenshots (all screens from FILE_INDEX)
- [ ] Demo video or live demo
- [ ] AI flow: face detection -> blink -> distance -> redness -> healthScore
- [ ] Security: rules + encryption + rate limiting
- [ ] Testing matrix + challenges table
- [ ] Future work
- [ ] Conclusion + Q&A

## What Was Lost & How to Mention in Viva

- Be honest: laptop/mobile stolen, only GitHub code survived, docs/*.docx thesis lost due to .gitignore, but you recovered via audit and now docs/ is tracked + backups in Drive
- Shows resilience and recovery planning - good for FYP

