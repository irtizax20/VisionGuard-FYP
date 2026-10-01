# 📋 File Index — Where Everything Goes

Each file in this pack should go to the exact path shown. Just open your project and replace.

| File in This Pack | Goes To | What It Fixes |
|---|---|---|
| `app/blink-test.tsx` | `app/blink-test.tsx` | Live camera preview (was showing static image) |
| `app/_layout.tsx` | `app/_layout.tsx` | Better navigation + theme provider |
| `app/index.tsx` | `app/index.tsx` | Premium gradient landing screen |
| `app/lock-screen.tsx` | `app/lock-screen.tsx` | Better lock screen UI + reliable trigger |
| `components/GradientCard.tsx` | `components/GradientCard.tsx` | NEW — reusable premium card |
| `components/AnimatedButton.tsx` | `components/AnimatedButton.tsx` | NEW — haptic + animated button |
| `components/EyeIcon.tsx` | `components/EyeIcon.tsx` | NEW — animated SVG eye logo |
| `components/SmartNotification.tsx` | `components/SmartNotification.tsx` | NEW — in-app non-intrusive notif |
| `contexts/SessionManager.tsx` | `contexts/SessionManager.tsx` | NEW — fixes user session mixing |
| `contexts/ScreenTimeContext.tsx` | `contexts/ScreenTimeContext.tsx` | Better lifecycle, no race conditions |
| `services/NotificationService.ts` | `services/NotificationService.ts` | Smart cooldown, less disturbing |
| `services/ParentChildService.ts` | `services/ParentChildService.ts` | Reliable Firestore listeners for child module |
| `services/DistanceCalculator.ts` | `services/DistanceCalculator.ts` | NEW — accurate IPD-based distance with smoothing |
| `utils/SessionCleanup.ts` | `utils/SessionCleanup.ts` | NEW — clean logout, no data leak |
| `constants/Colors.ts` | `constants/Colors.ts` | NEW premium color palette |
| `constants/Theme.ts` | `constants/Theme.ts` | NEW — spacing, typography, shadows |
| `android/app/src/main/AndroidManifest.xml` | Same path | Adds missing permissions, alarm support |
| `android/app/src/main/java/com/wajahat001/Blinkfit/ScreenTimeService.kt` | Same path | START_STICKY + AlarmManager fallback |
| `android/app/src/main/java/com/wajahat001/Blinkfit/BootReceiver.kt` | Same path | NEW — restart service on boot |

---

## 🎨 New Files You'll Add (No Replacement)

These are brand new files. Just copy them to the path shown — there's nothing to replace.

- `components/GradientCard.tsx`
- `components/AnimatedButton.tsx`
- `components/EyeIcon.tsx`
- `components/SmartNotification.tsx`
- `contexts/SessionManager.tsx`
- `services/DistanceCalculator.ts`
- `utils/SessionCleanup.ts`
- `constants/Theme.ts`
- `android/app/src/main/java/com/wajahat001/Blinkfit/BootReceiver.kt`

---

## 📝 Files NOT to Replace (Keep Your Originals)

- `firebase/firebaseConfig.ts` ← has your secret API keys
- `google-services.json` ← Firebase config
- `app.json` / `app.config.js` ← has your app's identity
- `package.json` ← I'll tell you what to add manually (in docs/01)
- `.env` ← your environment secrets
