# 02 - AI IMPLEMENTATION PLAN (Eye Health)
**Reconstructed 2026-08-28 - VisionGuard FYP**

## Current State (CONFIRMED)

- **ML Kit Face Detection:** `@react-native-ml-kit/face-detection 2.0.1` + native `com.google.mlkit:face-detection:16.1.7`
  - Used for: face detection, eye open probability (leftEyeOpenProbability, rightEyeOpenProbability), face size -> distance estimation
  - Files: `BlinkDetectionModule.kt`, `FaceDetectionService.ts` (630 lines)
- **Blink Detection:** Eye Aspect Ratio (EAR) or eye open probability < threshold = blink
  - `BlinkDetectionHelper.kt`: tracks blink count, average distance
  - `BlinkTrackingService.ts`: 505 lines, blink rate per minute, MIN_BLINKS_PER_MINUTE = 8 (in VisionGuardOverlayService.kt)
- **Eye Image Capture:** `EyeImageCaptureService.ts` 488 lines - captures left/right eye cropped from face detection, saves to app directory + MediaLibrary
- **No Custom Eye Disease Model Yet:** `.gitignore` has `*.pt`, `*.tflite`, `models/` ignored, but no model files in repo. Currently only ML Kit, no redness/ disease classification.

## What Was Planned (INFERRED from code + FYP scope)

### Phase 1: Basic Eye Health Metrics (DONE)

- [x] Blink rate: Count blinks in 30 sec detection, calculate per minute, alert if < 8/min
- [x] Screen distance: Face size (bounding box) -> distance formula: `distance = focalLength * realFaceHeight / faceHeightInPixels` (approx)
- [x] Eye image gallery: Capture eye crops during blink test
- [x] Daily summary: Screen time + blink count + breaks

### Phase 2: Eye Fatigue / Redness Detection (PARTIAL / TODO)

**Goal:** Detect eye redness, strain, fatigue from eye images

**Approach 1: Simple CV (No ML, for FYP MVP):**
- Redness score via RGB analysis:
  ```ts
  // In EyeImageCaptureService.ts after capture
  function calculateRednessScore(imageUri: string): number {
    // 1. Get image RGB data via expo-image-manipulator or native
    // 2. Isolate eye white region (sclera) via ML Kit eye landmarks
    // 3. Calculate red channel dominance: R / (R+G+B)
    // 4. Score 0-100: 0 = white, 100 = very red
    // 5. Save to Firestore redness_logs/{logId}: userId, timestamp, rednessScore
  }
  ```
- Eye strain events: If redness > 70 or blink rate < 8 for 10 mins, log eyeStrainEvent
- Files to modify: `EyeImageCaptureService.ts`, `DailySummaryService.ts`, `firestore.rules` already has `redness_logs` collection rules

**Approach 2: ML Model (For Higher Grade):**
- Dataset: Use `03_DATASETS_GUIDE.md` - Kaggle Eye Disease datasets, or self-collected eye images via app
- Model: Train MobileNetV2 or EfficientNet for binary classification: healthy vs red eye / fatigued
- Export: `.tflite` for on-device inference
- Integration:
  ```kotlin
  // In BlinkDetectionModule.kt add
  implementation 'org.tensorflow:tensorflow-lite:2.14.0'
  // Load model from assets, run inference on eye bitmap
  ```
- Or use Firebase ML Kit Custom Model

### Phase 3: Advanced (Optional, for Viva)

- **20-20-20 Rule Enforcement:** Every 20 mins, detect if user looked 20 feet away for 20 sec via face distance + eye tracking
- **Screen Time + Eye Health Correlation:** If screen time > 4h and blink rate low and redness high, healthScore low (0-100)
- **DailySummaryService healthScore:**
  ```ts
  healthScore = 100 - (screenTimeHours*5) - (rednessScore*0.3) - (blinkDeficit*2) + (breaksTaken*5)
  // Clamp 0-100
  ```
- **Recommendations:** Generate personalized tips based on metrics: "Your blink rate is 6/min (low), try blinking consciously", "Redness high, take break"

## Implementation Steps (Prioritized)

### Step 1: Redness Detection MVP (No ML) - 1 Day

1. In `EyeImageCaptureService.ts`, after capturing eye image:
   ```ts
   const redness = await calculateRednessFromImage(leftEyeUri, rightEyeUri);
   await saveRednessLog(userId, redness);
   ```
2. Implement `calculateRednessFromImage` using `expo-image-manipulator` to get base64, then simple RGB red dominance
3. Test with eye images gallery - show redness score in gallery card
4. Update `DailySummaryService` to include average redness in daily metrics

### Step 2: Blink Rate + Distance Alerts Already Done, Polish

- `VisionGuardOverlayService.kt` already has throttling: TTS_DISTANCE_THROTTLE 15s, BLINK_ALERT 60s, FATIGUE 20min
- Test TTS: "You are too close to screen", "Please blink more often", "You have been using screen for 20 minutes, take break"
- Ensure overlay permission SYSTEM_ALERT_WINDOW granted

### Step 3: Daily Summary Health Score

- In `DailySummaryService.ts`, implement:
  ```ts
  interface DailyEyeHealthMetrics {
    date: string;
    screenTime: number;
    estimatedBlinks: number;
    breaksTaken: number;
    eyeStrainEvents: number;
    averageScreenDistance: number;
    healthScore: number;
    recommendations: string[];
  }
  ```
- Calculate healthScore from real data (screen time from ScreenTimeContext, blinks from BlinkTrackingService, redness from redness_logs)
- Schedule 8PM notification with healthScore

### Step 4: Dataset Collection (For Future ML)

- Use app to collect eye images: during blink test, if user opts in, upload eye crops to Firebase Storage `eye_images/{userId}/{timestamp}_left.jpg`
- Label: user self-reports redness (0-10 slider) or use rednessScore as pseudo-label
- Export dataset via Firebase Console or script
- See `03_DATASETS_GUIDE.md` for public datasets

### Step 5: TFLite Model (If Time, for Extra Marks)

- Train in Python (Colab) using dataset from Step 4 + public datasets
- Model: MobileNetV2 binary classifier, input 224x224 eye crop, output redness probability
- Convert to TFLite, add to `assets/models/eye_redness.tflite` (remove from .gitignore)
- Native inference in `BlinkDetectionModule.kt` or JS via `tflite-react-native`

## Files to Modify

| File | Change |
|------|--------|
| `services/EyeImageCaptureService.ts` | Add redness calculation, save to Firestore |
| `services/DailySummaryService.ts` | Real healthScore from metrics |
| `services/BlinkTrackingService.ts` | Expose blink rate per minute |
| `android/app/src/main/java/.../BlinkDetectionModule.kt` | Add redness detection if doing native, or TFLite |
| `app/eye-images-gallery.tsx` | Show redness score |
| `app/daily-summary.tsx` | Show healthScore + recommendations |
| `firestore.rules` | Already has redness_logs rules |

## What Was Lost

- If you had trained custom `.tflite` model, it's gitignored and lost. Check Google Drive, Colab, or local backup.
- If you had Python training scripts in `ml/` or `.venv/`, lost due to gitignore.

## For Viva

- Explain ML Kit vs custom model tradeoff: ML Kit is on-device, fast, no training needed, good for FYP MVP; custom TFLite is more accurate but needs dataset + training time
- Show blink detection working on physical device (emulator camera fake)
- Show redness score calculation (even if simple RGB) - demonstrates CV understanding
- Mention future work: disease classification (cataract, etc) with larger datasets

