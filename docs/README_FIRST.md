# VisionGuard FYP - READ THIS FIRST
**Created:** Previous session (reconstructed 2026-08-28 after laptop theft)
**Purpose:** Start here before anything else

> ⚠️ RECOVERY NOTE: This file was part of your previous chat session and was lost due to .gitignore + stolen laptop. This is a reconstructed version from repo audit. If you have the original content, paste it and I'll update.

## What is VisionGuard?

VisionGuard (previously BlinkFit) is your FYP - an eye health companion mobile app built with:
- **Expo SDK 53 + React Native 0.79 + Firebase**
- **ML Kit Face Detection** for blink tracking
- **Native Android modules** (Kotlin) for screen time, overlay, TTS

**Package:** `com.wajahat001.blinkfit` (native) vs `com.irtiza001.visionguard` (app.json) - needs unification

## Repository State (as of 2026-08-28)

- **Single commit** `c71c0b6` on master - last fix was `bg_floating_bubble.xml` missing drawable
- **213 files**, 52k insertions
- **No .env**, no `google-services.json`, no `node_modules` - fresh laptop needs recreation
- **Critical bugs:** `app/screen-time.tsx` stubbed, `public/parent-approve.html` wrong Firebase project ID

## Where to Start?

1. Read `FYP_RECOVERY_AUDIT.md` (40KB full audit) - in repo root
2. Read `RECOVERY_TRACKER.md` - live checklist
3. Read `PENDING_IMPROVEMENTS.md` - reconstructed task list
4. Then read this docs folder in order:
   - `QUICK_START.md` - 5-min setup
   - `FILE_INDEX.md` - all files explained
   - `01_BUG_FIXES_EXPLAINED.md` - all bugs + fixes
   - `02_AI_IMPLEMENTATION_PLAN.md` - eye AI plan
   - `03_DATASETS_GUIDE.md` - datasets for eye disease
   - `04_UI_DESIGN_SYSTEM.md` - colors, themes, components
   - `05_FYP_PRESENTATION_TIPS.md` - viva tips

## First 3 Commands on New Laptop

```bash
# 1. Node 20 LTS + JDK 17 + Android Studio Platform 35 + NDK 26.1.10909125
node -v # should be v20.x
java -version # should be 17

# 2. Install deps
npm install --legacy-peer-deps

# 3. Create .env (from template in FYP_RECOVERY_AUDIT.md)
# FIREBASE_API_KEY=AIza...
```

## Important - Docs Now Tracked

Previously `.gitignore` had:
```
docs/
CODE_ANALYSIS_REPORT*.md
*.docx
```
This caused your task MDs to be lost. **Fixed now** - `docs/` is tracked, `.docx` is tracked. Future docs will sync to GitHub.

## Next Action

Tell agent: "Proceed with Phase 1" to make app runnable, or paste original content of these 7 files if you have them locally.

