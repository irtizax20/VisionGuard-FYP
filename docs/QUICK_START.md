# VisionGuard - QUICK START (5 Minutes)
**Reconstructed from repo audit**

## Prerequisites (Install Once)

1. **Node 20 LTS** - https://nodejs.org/ (not 22)
2. **JDK 17 Temurin** - https://adoptium.net/
3. **Android Studio** - SDK Platform 35, Build-Tools 35.0.0, NDK 26.1.10909125
4. **Set ANDROID_HOME** - `C:\Users\You\AppData\Local\Android\Sdk` (Win) or `~/Library/Android/sdk` (Mac)

## Setup (Every Fresh Clone)

```bash
git clone https://github.com/irtizax20/VisionGuard-FYP.git
cd VisionGuard-FYP
git checkout arena/01a04903-visionguard-fyp

npm install --legacy-peer-deps

# Create .env in root (copy from FYP_RECOVERY_AUDIT.md)
# Get google-services.json from Firebase Console vision-guard-f0daa -> android/app/

npx expo doctor
npx expo run:android
```

## First Run Checklist

- [ ] Splash screen shows logo + loading bar (2 sec)
- [ ] Redirects to Login (if no auth) or Main (if face verified)
- [ ] Test adult signup: name, email (gmail only), DOB, category adult, face capture
- [ ] Check email verification link in inbox
- [ ] Login -> face verification -> Main

## Common Build Errors & Fixes

| Error | Fix |
|-------|-----|
| `google-services.json missing` | Download from Firebase Console, place in `android/app/` |
| `NDK not found 26.1.10909125` | SDK Manager -> NDK -> install 26.1.10909125 |
| `Namespace mismatch` | Choose final package: `com.irtiza001.visionguard`, update build.gradle + all Kotlin files |
| `Task :app:compileDebugKotlin FAILED` | Check JDK version, should be 17, not 8 |
| `Metro bundler can't resolve` | `npx expo start --clear`, delete `.expo/` |
| `UsageStats permission` | On physical device, grant Usage Access when prompted, 4 retries then logout |

## 3 Commands to Test After Setup

```bash
adb devices # should list device
npx expo start # then press 'a' for android
adb logcat | grep VisionGuard # logs
```

## What Was Lost & Recreated

- `.env` - recreate from app.json extra
- `google-services.json` - re-download
- `docs/` MDs - reconstructed in this folder, now tracked

If you have original QUICK_START.md content, paste it here and I'll update.

