# 📚 Datasets Guide — Everything You Need to Improve Vision Guard

Comprehensive list of free, academic datasets you can download and use
to train or evaluate your eye-care models.

---

## 🥇 TOP PRIORITY DATASETS

### 1. MRL Eye Dataset ⭐ (Best for blink/closed-eye detection)
- **Size**: 84,898 images of human eyes
- **Labels**: open/closed, glasses/no-glasses, lighting conditions, gender
- **License**: Free for academic use
- **URL**: http://mrl.cs.vsb.cz/eyedataset
- **Why use it**: Industry standard for training eye-state classifiers. Used in 50+ published papers.
- **Use case**: Train your TFLite fatigue model (Phase 1 in AI plan)
- **Citation**: "Real-life drowsiness detection using a small eye-state dataset", VŠB-Technical University of Ostrava

**Download steps:**
1. Visit the URL above
2. Click "Download dataset (1.7 GB)"
3. Extract — folders are organized as `s0001/`, `s0002/` (one per subject)
4. Filenames encode labels: e.g. `s0001_00001_0_0_1_0_0_01.png`
   = subject 1, image 1, no glasses, eye open, etc.

---

### 2. CEW — Closed Eyes in the Wild ⭐
- **Size**: 2,423 images (1,192 closed, 1,231 open)
- **Labels**: binary (open/closed)
- **License**: Free for academic use
- **URL**: http://parnec.nuaa.edu.cn/_upload/tpl/02/db/731/template731/pages/xtan/ClosedEyeDatabases.html
- **Why use it**: Smaller and simpler than MRL — good for quick prototypes or fine-tuning.

---

### 3. UTA Real-Life Drowsiness Dataset (UTA-RLDD) ⭐
- **Size**: 30 hours of video, 60 subjects
- **Labels**: 3 classes — alert / low vigilant / drowsy
- **License**: Academic, sign agreement
- **URL**: https://sites.google.com/view/utarldd/home
- **Why use it**: The most realistic dataset for fatigue prediction.
- **Use case**: Train your PERCLOS-based fatigue scoring model

---

### 4. YawDD — Yawning Detection Dataset
- **Size**: 322 videos
- **Labels**: normal / talking / yawning
- **License**: Academic
- **URL**: https://ieee-dataport.org/open-access/yawdd-yawning-detection-dataset
- **Why use it**: Yawning is a strong fatigue indicator. Adds a feature your competitors don't have.

---

### 5. SBVPI — Sclera Blood Vessels (for redness research)
- **Size**: 1,858 images of eyes with labeled sclera regions
- **License**: Academic, request via email
- **URL**: http://sclera.fri.uni-lj.si/datasets.html
- **Why use it**: Train a sclera-segmentation model (better than OpenCV color-thresholding)
- **Use case**: Phase 3 redness detection — improve sclera ROI extraction

---

### 6. EyePACS / Kaggle Eye Disease Classification
- **Size**: 4,217 images across 4 disease classes
- **URL**: https://www.kaggle.com/datasets/gunavenkatdoddi/eye-diseases-classification
- **Why use it**: For your "future work" slide — show you can extend to disease screening (cataract, glaucoma, diabetic retinopathy)
- **Note**: These are retinal fundus images (taken with special equipment), not phone selfies. Use for "future scope" discussion only.

---

## 🔧 SECONDARY DATASETS

### 7. Helen Face Landmarks Dataset
- **URL**: http://www.ifp.illinois.edu/~vuongle2/helen/
- 2,330 face images with 194 landmarks each
- Useful if you want to fine-tune MediaPipe for kids' faces

### 8. 300-W (300 Faces in the Wild)
- **URL**: https://ibug.doc.ic.ac.uk/resources/300-W/
- 600 in-the-wild faces with 68 landmarks
- Tests robustness across angles and lighting

### 9. NTHU Drowsy Driver Detection
- **URL**: http://cv.cs.nthu.edu.tw/php/callforpaper/datasets/DDD/
- Driving simulator videos with drowsiness labels
- Requires email request

### 10. EyeBlink8 Dataset
- **URL**: https://www.blinkingmatters.com/research (note: may need archive.org)
- 8 videos with frame-by-frame blink annotations
- Perfect for testing your blink detection accuracy

---

## 🎯 WHICH DATASET FOR WHICH FEATURE?

| Vision Guard Feature | Recommended Dataset |
|---|---|
| Blink detection accuracy | **MRL** for training, **EyeBlink8** for testing |
| Eye-state classification (TFLite) | **MRL** (binary) |
| Fatigue / drowsiness scoring | **UTA-RLDD** |
| Yawning detection (bonus) | **YawDD** |
| Sclera segmentation (redness) | **SBVPI** |
| Face landmark robustness | **300-W** |
| Disease screening (future) | **EyePACS** |

---

## 🛠 How to Use a Dataset (Step by Step for a Beginner)

Let's walk through MRL Eye Dataset as an example.

### Step 1: Download
```bash
mkdir -p ~/datasets
cd ~/datasets
wget http://mrl.cs.vsb.cz/data/eyedataset/mrlEyes_2018_01.zip
unzip mrlEyes_2018_01.zip
```

### Step 2: Organize by label
The MRL filename format: `s{subjectID}_{imgID}_{gender}_{glasses}_{eyeState}_{reflections}_{lighting}_{sensor}.png`

Where `eyeState`:
- 0 = closed
- 1 = open

Quick Python script to organize:
```python
import os, shutil
src = '/Users/you/datasets/mrlEyes_2018_01'
dst = '/Users/you/datasets/mrl_organized'
os.makedirs(f'{dst}/open', exist_ok=True)
os.makedirs(f'{dst}/closed', exist_ok=True)

for subj in os.listdir(src):
    p = os.path.join(src, subj)
    if not os.path.isdir(p): continue
    for f in os.listdir(p):
        parts = f.split('_')
        if len(parts) < 5: continue
        eye_state = parts[4]
        target = 'open' if eye_state == '1' else 'closed'
        shutil.copy(os.path.join(p, f), f'{dst}/{target}/{f}')
print('Done!')
```

### Step 3: Train (in Google Colab — FREE)
Open https://colab.research.google.com → New notebook → paste this:

```python
# Cell 1 — Upload your organized dataset as zip
from google.colab import files
files.upload()  # upload mrl_organized.zip

# Cell 2 — Unzip
!unzip -q mrl_organized.zip

# Cell 3 — Train MobileNetV3 (fast on Colab GPU)
import tensorflow as tf

train_ds = tf.keras.preprocessing.image_dataset_from_directory(
    'mrl_organized', image_size=(96, 96), batch_size=64,
    validation_split=0.2, subset='training', seed=1
)
val_ds = tf.keras.preprocessing.image_dataset_from_directory(
    'mrl_organized', image_size=(96, 96), batch_size=64,
    validation_split=0.2, subset='validation', seed=1
)

base = tf.keras.applications.MobileNetV3Small(
    input_shape=(96, 96, 3), include_top=False, weights='imagenet'
)
base.trainable = False

model = tf.keras.Sequential([
    base,
    tf.keras.layers.GlobalAveragePooling2D(),
    tf.keras.layers.Dropout(0.3),
    tf.keras.layers.Dense(2, activation='softmax'),
])
model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
model.fit(train_ds, validation_data=val_ds, epochs=8)

# Cell 4 — Convert to TFLite
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_model = converter.convert()
with open('eye_state.tflite', 'wb') as f:
    f.write(tflite_model)

# Cell 5 — Download
from google.colab import files
files.download('eye_state.tflite')
```

### Step 4: Use in Vision Guard
Drop `eye_state.tflite` into `assets/models/`, then use the `FatigueService.ts` code from `docs/02_AI_IMPLEMENTATION_PLAN.md`.

**Total time**: 2 hours including downloading.

---

## 🏗 PRE-TRAINED MODELS (Skip training entirely)

If training is too much work, just download these and use directly:

### Hugging Face — Closed Eye Classifier
- **URL**: https://huggingface.co/dima806/closed_eyes_image_detection
- Accuracy: 99.06% on test set
- Format: PyTorch (needs ONNX → TFLite conversion)

### Hugging Face — Drowsiness Detection (search)
- **Search URL**: https://huggingface.co/models?search=drowsiness
- Multiple models, pick by accuracy reported in their model card

### TensorFlow Hub
- **URL**: https://tfhub.dev/
- Search "face" — gives you pre-converted TFLite models

### MediaPipe Models (just download `.task` file, plug-and-play)
- Face Landmarker: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task
- Face Detection: https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite
- Iris: included in Face Landmarker

---

## 📊 EVALUATION METRICS — What to report in your FYP

When you have your model running, evaluate it like this:

```python
# evaluation.py
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

# y_true, y_pred from your test set
print('Accuracy: ', accuracy_score(y_true, y_pred))
print('Precision:', precision_score(y_true, y_pred))
print('Recall:   ', recall_score(y_true, y_pred))
print('F1:       ', f1_score(y_true, y_pred))
print(confusion_matrix(y_true, y_pred))
```

For your FYP report, show:
- Confusion matrix
- Precision/recall (especially recall — missing a fatigue event is worse than a false alarm)
- Inference time on a real phone (target < 50ms per frame)

---

## 🎓 BONUS — Citations for your FYP report

```bibtex
@inproceedings{mrl2018,
  author    = {Fusek, Radovan},
  title     = {Pupil Localization Using Geodesic Distance},
  booktitle = {Advances in Visual Computing (ISVC)},
  year      = {2018},
}

@inproceedings{cew2014,
  author    = {Song, Fengyi and Tan, Xiaoyang and Liu, Xue and Chen, Songcan},
  title     = {Eyes Closeness Detection from Still Images with Multi-scale Histograms of Principal Oriented Gradients},
  journal   = {Pattern Recognition},
  year      = {2014},
}

@article{utarldd2019,
  author    = {Ghoddoosian, Reza and Galib, Marnim and Athitsos, Vassilis},
  title     = {A Realistic Dataset and Baseline Temporal Model for Early Drowsiness Detection},
  journal   = {CVPR Workshops},
  year      = {2019},
}
```

Put these in your bibliography. Panels love proper citations.
