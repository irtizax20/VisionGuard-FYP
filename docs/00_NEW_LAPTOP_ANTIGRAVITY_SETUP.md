# 00 - NEW LAPTOP SETUP + ANTIGRAVITY WORKFLOW (WINDOWS)
**Created:** 2026-10-02 (after laptop theft — fresh machine recovery)
**For:** VisionGuard FYP on Windows with Google Antigravity IDE
**Project:** https://github.com/irtizax20/VisionGuard-FYP

---

## PART 1 — WHAT TO DOWNLOAD (in this exact order)

| # | Software | Version | Why / Notes |
|---|----------|---------|-------------|
| 1 | **Git for Windows** | latest | Clone repo, version control. Already done ✔ |
| 2 | **Node.js LTS 20.x** | 20 LTS (NOT 22/24) | Expo SDK 53 requires Node 20. Install via nvm-windows or nodejs.org installer |
| 3 | **JDK 17 (Eclipse Temurin)** | 17 LTS | Android Gradle build (Gradle 8.13). Do NOT use JDK 8 or 11 |
| 4 | **Android Studio** | latest stable | Provides SDK Manager + emulator |
| 5 | **Android SDK Platform 35** | android-35 | compileSdk/targetSdk 35 |
| 6 | **Android SDK Build-Tools 35.0.0** | 35.0.0 | exact |
| 7 | **Android NDK** | **26.1.10909125** | Exact version forced in gradle.properties (Reanimated). Do NOT use 27.x |
| 8 | **Android SDK CMake** | 3.22.1 (or bundled) | Needed for native C++ (Reanimated) |
| 9 | **Android SDK Platform-Tools** | latest | `adb` for device |
| 10 | **Antigravity IDE** | latest | Already installed ✔ |
| 11 | *(optional)* **EAS CLI** | `npm i -g eas-cli` | Cloud builds (`eas build -p android`) |
| 12 | *(optional)* **Firebase CLI** | `npm i -g firebase-tools` | Deploy Firestore rules + functions |

### DO NOT install
- ❌ Node 22/24 — Expo 53 is validated on Node 20 LTS
- ❌ JDK 21+ (works for some setups but JDK 17 is the safe Expo 53 target)
- ❌ NDK 27.x — mismatch with gradle.properties (use 26.1.10909125)
- ❌ Yarn / pnpm — project has package-lock.json (npm)

---

## PART 2 — SET WINDOWS ENVIRONMENT VARIABLES

Open **System Properties → Environment Variables → User variables**:

```
JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot
ANDROID_HOME = C:\Users\MASTER\AppData\Local\Android\Sdk
```

Add to **PATH**:
```
%JAVA_HOME%\bin
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
%ANDROID_HOME%\cmdline-tools\latest\bin
```

Verify in a NEW terminal:
```bash
git --version
node -v        # v20.x.x
npm -v         # 10.x
java -version  # 17.x
adb version
echo %ANDROID_HOME%
```

---

## PART 3 — PROJECT SETUP (in Antigravity terminal)

> In Antigravity: `File → Open Folder → VisionGuard-FYP` (the GitHub clone).
> Open the built-in terminal (`Ctrl + ~`) and run:

```bash
# 1. Confirm the right branch
git fetch origin
git checkout arena/01a04903-visionguard-fyp   # has docs + tracker (db594a1)
git pull

# 2. Install JS dependencies (React 19 peer-dep conflicts are expected)
npm install --legacy-peer-deps

# 3. Create .env in project root (COPY FROM docs/QUICK_START.md template)
#    + FIREBASE_* keys, ENCRYPTION_KEY

# 4. Place google-services.json  (MANUAL — Firebase Console)
#    Firebase Console → vision-guard-f0daa → Project Settings → Your Apps → Android
#    → copy to: android\app\google-services.json

# 5. Check health
npx expo doctor

# 6. First build (plug in phone with USB debugging, or start emulator)
npx expo run:android
```

First build takes **10–20 min** (downloads Gradle 8.13 + dependencies).

---

## PART 4 — ANTIGRAVITY WORKFLOW (how the MD files are used)

The `docs/*.md` files are **agent instructions**. Workflow:

1. Open the relevant MD in Antigravity (e.g. `docs/01_BUG_FIXES_EXPLAINED.md`)
2. In Antigravity Agent/Chat panel, tell it:
   > "Read `docs/01_BUG_FIXES_EXPLAINED.md` and apply the fixes for bugs marked ❌ Open. Do one bug at a time, explain changes, then wait for my confirmation."
3. Review the diff → Accept → run the app → test on device → commit:

```bash
git add -A
git commit -m "fix: <what you fixed>"
git push origin arena/01a04903-visionguard-fyp
```

4. Update `RECOVERY_TRACKER.md` checkboxes after every fix.

### Golden rules for the agent
- One bug/task per prompt — smaller diffs = safer
- Never upgrade Expo/RN/Firebase versions
- Never touch working auth/face-verification flow without being asked
- Always test on **physical device** (camera + UsageStats don't work in emulator)
- Commit + push after every verified change (prevents loss again)

---

## PART 5 — DEVICE SETUP (physical Android phone)

1. Phone → Settings → About → tap **Build number** 7× → Developer Options
2. Enable **USB debugging** (+ **USB install** if asked)
3. Connect via USB → on phone accept "Allow USB debugging"
4. `adb devices` should list the device
5. App will request these permissions — grant each:
   - Camera
   - Usage Access (Settings → Special access → Usage access → VisionGuard)
   - Battery optimization → Unrestricted
   - Display over other apps (overlay bubble)
   - Notifications
6. If permission denied 4× in Main.tsx → app logs out (by design)

### Emulator fallback
- Create Pixel 8 API 35 AVD in Android Studio
- ⚠️ Emulator camera is fake → face capture/verification and blink test won't truly work; use only for UI checks

---

## PART 6 — WHAT'S MISSING LOCALLY (recreate before building)

| Missing item | How to get it |
|--------------|---------------|
| `.env` | Template in `docs/QUICK_START.md` (from app.json extra) |
| `google-services.json` | Firebase Console → vision-guard-f0daa → Android app |
| Release keystore (`.jks`) | Create new: `keytool -genkeypair ...` (was lost) |
| `node_modules/` | `npm install --legacy-peer-deps` |
| SendGrid API key | SendGrid dashboard → Settings → API Keys (for parent approval emails) |

---

## PART 7 — GITHUB SAFETY (never lose work again)

`docs/`, `*.docx`, and `CODE_ANALYSIS_REPORT*.md` were removed from `.gitignore` — they are now tracked.

**Every session routine:**
```bash
git status                 # before starting
git pull                   # get latest
# ... work with Antigravity ...
git add -A && git commit -m "..." && git push origin arena/01a04903-visionguard-fyp
```

**Create a PR to master when a milestone is done** (so master stays current):
```
https://github.com/irtizax20/VisionGuard-FYP/pull/new/arena/01a04903-visionguard-fyp
```

---

## PART 8 — QUICK COMMAND CHEATSHEET

| Task | Command |
|------|---------|
| Install deps | `npm install --legacy-peer-deps` |
| Run on Android | `npx expo run:android` |
| Run with cache clear | `npx expo start --clear` |
| Health check | `npx expo doctor` |
| Device logs | `adb logcat | grep -E "VisionGuard|BlinkDetection"` |
| Kill Gradle daemon | `cd android && gradlew --stop` |
| Clean Android build | `cd android && gradlew clean` |
| Deploy Firestore rules | `firebase deploy --only firestore:rules,storage:rules` |
| Deploy functions | `cd functions && npm install && firebase deploy --only functions` |
| EAS preview APK | `eas build -p android --profile preview` |

---

## PART 9 — TROUBLESHOOTING

| Error | Fix |
|-------|-----|
| `google-services.json missing` | PART 3 step 4 |
| `NDK 26.1.10909125 not found` | SDK Manager → Show Package Details → NDK → check 26.1.10909125 |
| `Namespace 'com.wajahat001.blinkfit' mismatch` | Known bug — see `docs/01_BUG_FIXES_EXPLAINED.md` Bug 4 |
| `ERESOLVE peer dep` | add `--legacy-peer-deps` |
| `Java version mismatch` | `JAVA_HOME` must be JDK 17, restart terminal |
| `adb: no devices` | install OEM USB driver / accept debugging prompt |
| Metro resolve errors | `npx expo start --clear` + delete `.expo\` |
| Gradle out of memory | in `android/gradle.properties`: `org.gradle.jvmargs=-Xmx4096m` |
| Build fails after long error | `cd android && gradlew clean`, rebuild |

---

**Created by:** Arena agent recovery session
**Related:** `FYP_RECOVERY_AUDIT.md`, `RECOVERY_TRACKER.md`, `PENDING_IMPROVEMENTS.md`, `docs/README_FIRST.md`
