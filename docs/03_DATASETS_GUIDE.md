# 03 - DATASETS GUIDE (Eye Health)
**Reconstructed 2026-08-28**

## Current State

- **No datasets in repo** - `data/`, `ml/data/`, `*.pt`, `*.tflite` all gitignored, and no dataset files found
- **App collects eye images:** `EyeImageCaptureService.ts` captures left/right eye crops during blink test, saves to app directory and optionally to gallery
- **Firestore collections for data:** `eye_images`, `eye_analysis`, `redness_logs`, `daily_summaries` - can be used to build dataset

## Public Datasets for Eye Health FYP

### 1. Eye Redness / Fatigue (For Redness Detection)

| Dataset | Link | Description | Size | License |
|---------|------|-------------|------|---------|
| **Kaggle - Eye Disease Classification** | https://www.kaggle.com/datasets/gunavenkatdoddi/eye-diseases-classification | 4 classes: cataract, diabetic retinopathy, glaucoma, normal | ~4k images | CC0 |
| **Kaggle - Red Eye Dataset** | Search "red eye" on Kaggle - multiple small datasets of conjunctivitis/red eye | Red vs normal eye | Varies | Various |
| **MRL Eye Dataset** | http://mrl.cs.vsb.cz/eyedataset | Closed eye vs open eye, for blink detection | 84k images | Research |
| **CEW (Closed Eyes in Wild)** | https://parnec.nuaa.edu.cn/xtan/data/ClosedEyeDatabases.html | Closed eyes dataset | 2k images | Research |

**For FYP MVP:** You don't need large dataset. Use simple RGB redness detection (see 02_AI_IMPLEMENTATION_PLAN.md) - no dataset needed.

### 2. Blink Detection Datasets (For Blink Rate)

| Dataset | Link | Description |
|---------|------|-------------|
| **ZJU Eyeblink** | http://www.cs.zju.edu.cn/~gpan/database/db_blink.html | 80k eye images, open/closed labels |
| **RT-BENE** | https://github.com/iaslab-unipd/rb-bene | Blink estimation in wild |
| **MRL Eye** | Same as above - open/closed | Good for blink classifier |

**For VisionGuard:** You already have blink detection via ML Kit eye open probability - no need for extra dataset, but you can mention these in thesis for literature review.

### 3. Screen Distance / Face Datasets

- **No specific dataset needed** - distance via face bounding box size from ML Kit
- Formula: `distance = (realFaceHeight * focalLength) / faceHeightPixels` - focalLength from camera calibration or approximate

### 4. Custom Dataset Collection via App (Recommended for FYP)

**Best for FYP:** Collect your own dataset using VisionGuard app itself - demonstrates real-world data collection

**Steps:**

1. **Enable opt-in in app:**
   ```tsx
   // In blink-test.tsx or Setting.tsx
   <Switch value={allowDataCollection} onValueChange={setAllowDataCollection} />
   <Text>Help improve eye health AI by sharing anonymized eye images (opt-in)</Text>
   ```

2. **Upload eye crops to Firebase Storage:**
   ```ts
   // In EyeImageCaptureService.ts
   if (allowDataCollection) {
     const storageRef = ref(storage, `datasets/eye_images/${userId}/${Date.now()}_left.jpg`);
     await uploadBytes(storageRef, leftEyeBlob);
     // Save metadata to Firestore: eye_images collection already exists
     await addDoc(collection(db, 'eye_images'), {
       userId,
       timestamp: Date.now(),
       leftEyeUri: storagePath,
       rightEyeUri: storagePath,
       rednessSelfReport: userSliderValue, // 0-10
       blinkRate: currentBlinkRate,
       screenDistance: currentDistance
     });
   }
   ```

3. **Labeling:**
   - **Self-report:** User rates redness 0-10 after capture, or reports fatigue
   - **Pseudo-label:** Use RGB redness score as label (from 02_AI_IMPLEMENTATION_PLAN.md)
   - **Manual:** Export images and label manually via LabelImg or simple script

4. **Export:**
   - Firebase Console > Storage > datasets/eye_images > Download
   - Or script: `gsutil cp -r gs://vision-guard-f0daa.appspot.com/datasets/ ./local_datasets/`
   - Or Firestore export: `firebase firestore:export`

5. **Structure:**
   ```
   datasets/
     eye_images/
       user1/
         1715623456_left.jpg
         1715623456_right.jpg
         metadata.json (redness, blinkRate, distance, selfReport)
   ```

### 5. How to Use Datasets in FYP Thesis

**Chapter: Dataset & Preprocessing**

- **Public datasets:** Mention you reviewed Kaggle Eye Disease, MRL Eye, CEW for literature, but for privacy and FYP scope you collected custom dataset via app (GDPR, user consent)
- **Custom dataset:** 50-100 users, 5-10 eye images each = 500-1000 images, enough for simple classifier
- **Preprocessing:** Crop eye via ML Kit landmarks, resize 224x224, normalize RGB, augment (flip, brightness)
- **Split:** 70% train, 20% val, 10% test
- **Ethics:** User opt-in, anonymized (no face, only eye crop), stored securely in Firebase with rules

### 6. Training (If Doing TFLite)

**Colab Notebook (Python):**

```python
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D

# Load custom dataset
train_ds = tf.keras.utils.image_dataset_from_directory(
  'datasets/eye_images',
  labels='inferred',
  label_mode='binary', # red vs normal
  image_size=(224,224),
  validation_split=0.2,
  subset='training'
)

# Transfer learning
base = MobileNetV2(input_shape=(224,224,3), include_top=False, weights='imagenet')
base.trainable = False
model = tf.keras.Sequential([
  base,
  GlobalAveragePooling2D(),
  Dense(1, activation='sigmoid')
])
model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
model.fit(train_ds, validation_data=val_ds, epochs=10)

# Convert to TFLite
converter = tf.lite.TFLiteConverter.from_keras_model(model)
tflite_model = converter.convert()
open('eye_redness.tflite','wb').write(tflite_model)
```

**Then add to app:**
- Place `eye_redness.tflite` in `assets/models/` (remove from .gitignore)
- Load in Kotlin or via `tflite-react-native`

### 7. What Was Lost

- If you had `data/` folder with eye images, lost due to gitignore `data/`, `ml/data/`
- If you had `.pt`, `.onnx`, `.tflite` models, lost due to gitignore
- Check Google Drive, Colab, or local backup for any trained models

### 8. For Viva

- **Dataset size:** Even 100 images is okay for FYP if you explain collection method and ethics
- **No dataset needed for MVP:** You can say "For MVP we used ML Kit + RGB heuristic, no dataset needed, but we designed collection pipeline for future ML"
- **Privacy:** Emphasize eye crops only, not full face, opt-in, Firebase rules restrict to owner + parent

## Quick Links

- Kaggle Eye Disease: https://www.kaggle.com/datasets/gunavenkatdoddi/eye-diseases-classification
- MRL Eye: http://mrl.cs.vsb.cz/eyedataset
- Firebase Storage: https://console.firebase.google.com/project/vision-guard-f0daa/storage

