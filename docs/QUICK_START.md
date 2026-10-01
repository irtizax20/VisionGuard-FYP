# ⚡ Quick Start — Apply Fixes in 15 Minutes

Read this if you just want to **get the fixes running** as fast as possible.

---

## Step 1: Backup (1 min)
Open File Explorer / Finder, **copy your whole `VisionGuard-FYP` folder**
to your Desktop and rename it `VisionGuard-FYP-BACKUP`.

If anything breaks, you can restore from here.

---

## Step 2: Install required new package (2 min)
Open terminal/CMD in your project folder. Run:
```bash
npm install expo-linear-gradient
```

That's the only new dependency. Everything else (`expo-camera`, `expo-haptics`,
`expo-speech`, `@expo/vector-icons`) you already have.

---

## Step 3: Copy the files (5 min)

Open the `vision-guard-fixes/` folder from this zip.

For each file/folder inside it, **drag into the matching place** in your project:

| From this zip | Drag into your project |
|---|---|
| `app/blink-test.tsx` | `app/blink-test.tsx` *(replace)* |
| `app/index.tsx` | `app/index.tsx` *(replace — see note below)* |
| `app/lock-screen.tsx` | `app/lock-screen.tsx` *(replace)* |
| `components/*.tsx` | `components/` *(new files, no replace)* |
| `contexts/SessionManager.tsx` | `contexts/` *(new file)* |
| `contexts/ScreenTimeContext.tsx` | `contexts/ScreenTimeContext.tsx` *(replace)* |
| `services/*.ts` | `services/` *(new files — keep your existing ones)* |
| `utils/SessionCleanup.ts` | `utils/` *(new file)* |
| `constants/Colors.ts` | `constants/Colors.ts` *(replace)* |
| `constants/Theme.ts` | `constants/` *(new file)* |
| `android/app/src/main/AndroidManifest.xml` | Replace your current one |
| `android/app/src/main/java/com/wajahat001/Blinkfit/*.kt` | Add to that folder |

### ⚠️ About `app/index.tsx`
The new `index.tsx` is the premium dashboard. If your current `index.tsx` does
**routing logic** (sends user to login if not authed), you have two options:

**Option A — Rename the new one:**
```
Rename app/index.tsx (from zip) → app/home.tsx
Don't replace your existing index.tsx
Update your login flow to navigate to '/home' after login
```

**Option B — Replace yours:**
Replace your `app/index.tsx` and add routing at the top:
```tsx
import { Redirect } from 'expo-router';
import { useSession } from '@/contexts/SessionManager';

// At the top of HomeScreen():
const { user, loading } = useSession();
if (loading) return null;
if (!user) return <Redirect href="/(auth)/login" />;
```

---

## Step 4: Update your `_layout.tsx` (2 min)

In `app/_layout.tsx`, wrap your app with the new providers:

```tsx
import { SessionProvider } from '@/contexts/SessionManager';
import { ScreenTimeProvider } from '@/contexts/ScreenTimeContext';
import SmartNotification, { SmartNotificationHandle } from '@/components/SmartNotification';
import { useRef } from 'react';

// Inside your RootLayout component:
const notifRef = useRef<SmartNotificationHandle>(null);

return (
  <SessionProvider>
    <ScreenTimeProvider>
      {/* your existing Stack / Tabs */}
      <SmartNotification ref={notifRef} />
    </ScreenTimeProvider>
  </SessionProvider>
);
```

---

## Step 5: Rebuild Android (3 min)

```bash
npx expo prebuild --clean
npx expo run:android
```

The `prebuild --clean` is **required** because we changed the AndroidManifest
and added new Kotlin files.

---

## Step 6: Grant permissions on the device

When the app launches:
1. Allow camera ✅
2. Allow notifications ✅
3. **Go to phone Settings → Apps → Vision Guard → Battery → Unrestricted** (CRITICAL for the 2-hour lock)
4. Settings → Display over other apps → Allow Vision Guard ✅
5. Settings → Usage access → Allow Vision Guard ✅

---

## Step 7: Test the fixes

### Test 1: Live camera in blink test
- Open the app → Blink Test
- You should now see a LIVE camera feed (not a static image)
- Tap Start → blink → see the counter go up in real-time

### Test 2: Distance warning
- Move phone very close to your face (under 25cm)
- "TOO CLOSE — Move back" badge appears + TTS speaks

### Test 3: Logout cleans data
- Sign in as user A → use the app for 1 minute
- Sign out → sign in as user B
- User B should NOT see user A's screen-time/blink counts

### Test 4: 2-hour lock (in demo mode)
- Open `ScreenTimeService.kt` → change:
  ```kotlin
  const val DEFAULT_BREAK_INTERVAL_MS: Long = 2L * 60L * 1000L // 2 MINUTES for demo
  ```
- Rebuild
- Start tracking → lock the phone, wait 2 minutes
- Wake phone → the lock screen should appear

---

## 🆘 Troubleshooting

### Build fails with "expo-linear-gradient not found"
```bash
npx expo install expo-linear-gradient
```

### "Cannot resolve @/constants/Theme"
Make sure your `tsconfig.json` has:
```json
"paths": { "@/*": ["./*"] }
```
(If you used create-expo-app, this is already there.)

### App crashes on launch after AndroidManifest replace
Likely a permission name typo. Compare your old manifest's `<application>`
block with the new one and merge any custom `<activity>` or `<meta-data>` from
yours into mine. The new one is a *template*, not exhaustive.

### Camera shows but blink count doesn't update
Your native `BlinkDetectionService` isn't emitting events.
Check `BlinkDetectionModule.kt` — make sure `sendEvent("BlinkDetected", ...)`
is being called.

### Lock screen never appears
1. Did you grant overlay permission? Settings → Display over other apps
2. Did you grant battery unrestricted? Settings → Battery → Unrestricted
3. Check logcat: `adb logcat | grep ScreenTime`

---

## 🎯 What's Next?

Once these fixes work, read:
- `docs/02_AI_IMPLEMENTATION_PLAN.md` — to add the TFLite fatigue model
- `docs/05_FYP_PRESENTATION_TIPS.md` — to prepare for your panel demo

You've got this! 🚀
