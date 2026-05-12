package com.wajahat001.blinkfit

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.Rect
import android.util.Log
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.*
import kotlinx.coroutines.guava.await
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class BlinkDetectionModule(private val reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "BlinkDetectionModule"
        private const val DETECTION_DURATION = 30000L // 30 seconds
        private const val DISTANCE_INTERVAL = 3000L
    }

    private val detectionHelper = BlinkDetectionHelper()
    private var cameraExecutor: ExecutorService? = null
    private var detectionJob: Job? = null
    private var camera: Camera? = null
    private var isDetecting = false
    
    // Eye image capture settings
    private var eyeCaptureEnabled = false
    private var eyeCaptureDirectory: String? = null
    private var eyesCaptured = false

    private val faceDetectorOptions = FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
        .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
        .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL) // ✅ Enable for eye openness
        .setMinFaceSize(0.15f)
        .enableTracking()
        .build()

    private val faceDetector = FaceDetection.getClient(faceDetectorOptions)

    override fun getName(): String = "BlinkDetectionModule"

    @ReactMethod
    fun startDetection(promise: Promise) {
        Log.d(TAG, "startDetection() called, current state: isDetecting=$isDetecting")
        
        if (isDetecting) {
            Log.w(TAG, "Detection already in progress")
            promise.reject("DETECTION_IN_PROGRESS", "Detection already in progress")
            return
        }

        if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.CAMERA) 
            != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "Camera permission not granted")
            promise.reject("PERMISSION_DENIED", "Camera permission required")
            return
        }
        
        val activity = currentActivity
        if (activity == null) {
            Log.e(TAG, "Activity is null - cannot start camera")
            promise.reject("NO_ACTIVITY", "Activity not available. Please try again.")
            return
        }

        Log.d(TAG, "All checks passed, starting blink detection...")
        
        detectionHelper.reset()
        eyesCaptured = false
        isDetecting = true
        cameraExecutor = Executors.newSingleThreadExecutor()

        detectionJob = CoroutineScope(Dispatchers.Main).launch {
            try {
                startCamera()
                Log.d(TAG, "startCamera() completed, resolving promise")
                promise.resolve(null)
            } catch (e: Exception) {
                Log.e(TAG, "Detection error", e)
                isDetecting = false
                promise.reject("DETECTION_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun stopDetection(promise: Promise) {
        if (!isDetecting) {
            promise.reject("NOT_DETECTING", "No detection in progress")
            return
        }

        stopCamera()
        
        val results = Arguments.createMap().apply {
            putInt("blinkCount", detectionHelper.getBlinkCount())
            putDouble("averageScreenDistance", detectionHelper.getAverageDistance().toDouble())
            putInt("distanceMeasurements", detectionHelper.getDistanceMeasurementCount())
            putInt("durationSeconds", (DETECTION_DURATION / 1000).toInt())
        }

        Log.d(TAG, "Detection stopped. Results: Blinks=${detectionHelper.getBlinkCount()}, " +
                "Avg Distance=${detectionHelper.getAverageDistance()}")

        isDetecting = false
        promise.resolve(results)
    }

    @ReactMethod
    fun getDetectionStatus(promise: Promise) {
        val status = Arguments.createMap().apply {
            putBoolean("isDetecting", isDetecting)
            putInt("currentBlinkCount", detectionHelper.getBlinkCount())
            putInt("currentDistanceMeasurements", detectionHelper.getDistanceMeasurementCount())
        }
        promise.resolve(status)
    }

    @ReactMethod
    fun enableEyeImageCapture(directory: String, promise: Promise) {
        try {
            val dir = File(directory)
            if (!dir.exists()) {
                dir.mkdirs()
            }
            eyeCaptureDirectory = directory
            eyeCaptureEnabled = true
            eyesCaptured = false
            Log.d(TAG, "✅ Eye image capture enabled, directory: $directory")
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to enable eye capture", e)
            promise.reject("EYE_CAPTURE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun disableEyeImageCapture(promise: Promise) {
        eyeCaptureEnabled = false
        eyeCaptureDirectory = null
        eyesCaptured = false
        Log.d(TAG, "Eye image capture disabled")
        promise.resolve(null)
    }

    @ReactMethod
    fun captureEyeImagesManually(promise: Promise) {
        Log.d(TAG, "📸 Manual eye capture triggered")
        
        if (!eyeCaptureEnabled) {
            Log.e(TAG, "❌ Eye capture not enabled")
            promise.reject("NOT_ENABLED", "Eye capture must be enabled first")
            return
        }
        
        if (eyeCaptureDirectory == null) {
            Log.e(TAG, "❌ Eye capture directory is null")
            promise.reject("NO_DIRECTORY", "Eye capture directory not set")
            return
        }
        
        if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.CAMERA) 
            != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "❌ Camera permission not granted")
            promise.reject("PERMISSION_DENIED", "Camera permission required")
            return
        }
        
        val activity = currentActivity
        if (activity == null) {
            Log.e(TAG, "❌ Activity is null")
            promise.reject("NO_ACTIVITY", "Activity not available")
            return
        }
        
        Log.d(TAG, "Starting manual capture process...")
        eyesCaptured = false
        cameraExecutor = Executors.newSingleThreadExecutor()
        
        CoroutineScope(Dispatchers.Main).launch {
            try {
                startCameraForManualCapture()
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "❌ Manual capture error", e)
                promise.reject("CAPTURE_ERROR", e.message)
            }
        }
    }

    private suspend fun startCameraForManualCapture() = withContext(Dispatchers.Main) {
        try {
            val cameraProvider = ProcessCameraProvider.getInstance(reactContext).await()
            val activity = currentActivity as? LifecycleOwner 
                ?: throw IllegalStateException("Activity is not a LifecycleOwner")
            
            cameraProvider.unbindAll()
            
            val preview = Preview.Builder().build()
            val imageAnalysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
            
            imageAnalysis.setAnalyzer(cameraExecutor!!) { imageProxy ->
                processImageForManualCapture(imageProxy)
            }
            
            val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA
            camera = cameraProvider.bindToLifecycle(activity, cameraSelector, preview, imageAnalysis)
            
            Log.d(TAG, "✅ Camera started for manual capture")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to start camera for manual capture", e)
            throw e
        }
    }

    private fun processImageForManualCapture(imageProxy: ImageProxy) {
        if (eyesCaptured) {
            imageProxy.close()
            return
        }
        
        try {
            val mediaImage = imageProxy.image
            if (mediaImage == null) {
                imageProxy.close()
                return
            }
            
            val inputImage = InputImage.fromMediaImage(
                mediaImage,
                imageProxy.imageInfo.rotationDegrees
            )
            
            faceDetector.process(inputImage)
                .addOnSuccessListener { faces ->
                    if (faces.isNotEmpty() && !eyesCaptured) {
                        val face = faces[0]
                        
                        // Check if eyes are open
                        val leftEyeOpen = face.leftEyeOpenProbability ?: 0f
                        val rightEyeOpen = face.rightEyeOpenProbability ?: 0f
                        
                        Log.d(TAG, "👁️ Eye openness - Left: $leftEyeOpen, Right: $rightEyeOpen")
                        
                        if (leftEyeOpen > 0.7f && rightEyeOpen > 0.7f) {
                            Log.d(TAG, "✅ Both eyes open, capturing images...")
                            captureEyeImages(imageProxy, face)
                            eyesCaptured = true
                            
                            // Stop camera after successful capture
                            CoroutineScope(Dispatchers.Main).launch {
                                delay(500)
                                stopCamera()
                            }
                        }
                    }
                    imageProxy.close()
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Face detection failed", e)
                    imageProxy.close()
                }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing image", e)
            imageProxy.close()
        }
    }

    private suspend fun startCamera() = withContext(Dispatchers.Main) {
        try {
            Log.d(TAG, "Requesting CameraProvider...")
            val cameraProvider = ProcessCameraProvider.getInstance(reactContext).await()
            Log.d(TAG, "✅ CameraProvider obtained")
            
            // Verify activity is valid and is a LifecycleOwner
            val activity = currentActivity
            if (activity == null) {
                throw IllegalStateException("Activity is null")
            }
            
            if (activity !is LifecycleOwner) {
                throw IllegalStateException("Activity is not a LifecycleOwner")
            }
            
            Log.d(TAG, "Activity verified: ${activity.javaClass.simpleName}")
            
            val preview = Preview.Builder().build()
            val imageAnalysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()

            val startTime = System.currentTimeMillis()
            // Use atomic reference for thread-safe updates
            val lastDistanceTimeRef = java.util.concurrent.atomic.AtomicLong(startTime)

            imageAnalysis.setAnalyzer(cameraExecutor!!) { imageProxy ->
                processImage(imageProxy, startTime, lastDistanceTimeRef)
            }

            val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA
            
            Log.d(TAG, "Unbinding all cameras...")
            cameraProvider.unbindAll()
            
            Log.d(TAG, "Binding camera to lifecycle...")
            camera = cameraProvider.bindToLifecycle(
                activity,
                cameraSelector,
                preview,
                imageAnalysis
            )

            Log.d(TAG, "✅ Camera started successfully, detection running for 30 seconds")
            
            // Auto-stop after duration
            CoroutineScope(Dispatchers.Main).launch {
                delay(DETECTION_DURATION)
                if (isDetecting) {
                    Log.d(TAG, "⏱️ Auto-stopping detection after ${DETECTION_DURATION}ms")
                    try {
                        val results = Arguments.createMap().apply {
                            putInt("blinkCount", detectionHelper.getBlinkCount())
                            putDouble("averageScreenDistance", detectionHelper.getAverageDistance().toDouble())
                            putInt("distanceMeasurements", detectionHelper.getDistanceMeasurementCount())
                            putInt("durationSeconds", (DETECTION_DURATION / 1000).toInt())
                        }
                        
                        stopCamera()
                        isDetecting = false
                        
                        Log.d(TAG, "📊 Results: Blinks=${detectionHelper.getBlinkCount()}, Distance=${detectionHelper.getAverageDistance()}, Measurements=${detectionHelper.getDistanceMeasurementCount()}")
                        
                        // Send event to React Native
                        reactContext
                            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            .emit("onDetectionComplete", results)
                        
                        Log.d(TAG, "✅ Event 'onDetectionComplete' emitted")
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ Auto-stop error", e)
                    }
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "❌ Camera start failed", e)
            isDetecting = false
            throw e
        }
    }

    @androidx.camera.core.ExperimentalGetImage
    private fun processImage(
        imageProxy: ImageProxy,
        startTime: Long,
        lastDistanceTimeRef: java.util.concurrent.atomic.AtomicLong
    ) {
        val currentTime = System.currentTimeMillis()
        val elapsedTime = currentTime - startTime

        // Stop processing if duration exceeded
        if (elapsedTime >= DETECTION_DURATION) {
            imageProxy.close()
            return
        }

        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }

        try {
            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
            var shouldCloseProxy = true
            
            faceDetector.process(image)
                .addOnSuccessListener { faces ->
                    if (faces.isNotEmpty()) {
                        val face = faces[0]
                        
                        // Capture eye images on first face detection (before blink analysis)
                        if (eyeCaptureEnabled && !eyesCaptured && eyeCaptureDirectory != null) {
                            try {
                                Log.d(TAG, "🎯 Attempting to capture eye images in background...")
                                // Offload to background coroutine so we don't block ML Kit analyzer
                                val currentFace = face // Capture local reference
                                val currentImageProxy = imageProxy // Capture proxy, but don't close yet
                                eyesCaptured = true // Set immediately to prevent multiple triggers
                                shouldCloseProxy = false // Let the coroutine close it
                                
                                CoroutineScope(Dispatchers.IO).launch {
                                    try {
                                        captureEyeImages(currentImageProxy, currentFace)
                                    } catch (e: Exception) {
                                        Log.e(TAG, "❌ Eye capture background error", e)
                                        eyesCaptured = false // Reset on failure
                                    } finally {
                                        currentImageProxy.close()
                                    }
                                }
                            } catch (e: Exception) {
                                Log.e(TAG, "❌ Eye capture scheduling error", e)
                                eyesCaptured = false
                            }
                        } else {
                            if (!eyeCaptureEnabled) {
                                // Log.d(TAG, "⏭️ Eye capture disabled")
                            } else if (eyesCaptured) {
                                // Log.d(TAG, "⏭️ Eye images already captured this session")
                            } else if (eyeCaptureDirectory == null) {
                                Log.e(TAG, "❌ Eye capture directory is NULL!")
                            }
                        }
                        
                        // Process blink detection
                        try {
                            detectionHelper.processBlink(face)
                        } catch (e: Exception) {
                            Log.e(TAG, "Blink processing error", e)
                        }
                        
                        // Process distance measurement with thread-safe timing
                        val lastDistanceTime = lastDistanceTimeRef.get()
                        if (currentTime - lastDistanceTime >= DISTANCE_INTERVAL) {
                            try {
                                val distance = detectionHelper.calculateDistance(face, image.width)
                                if (distance != null) {
                                    detectionHelper.addDistanceMeasurement(distance)
                                    lastDistanceTimeRef.set(currentTime)
                                    Log.d(TAG, "📏 Distance: ${distance.toInt()} cm")
                                    
                                    if (distance < 40f) {
                                        // Emit distance warning event to JS
                                        val warningData = Arguments.createMap().apply {
                                            putDouble("distance", distance.toDouble())
                                        }
                                        reactContext
                                            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                                            .emit("onDistanceWarning", warningData)
                                        Log.d(TAG, "⚠️ Distance Warning Emitted: ${distance.toInt()} cm (Threshold: 40cm)")
                                    }
                                }
                            } catch (e: Exception) {
                                Log.e(TAG, "Distance calculation error", e)
                            }
                        }
                    }
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Face detection error", e)
                }
                .addOnCompleteListener {
                    if (shouldCloseProxy) {
                        imageProxy.close()
                    }
                }
        } catch (e: Exception) {
            Log.e(TAG, "Image processing error", e)
            imageProxy.close()
        }
    }

    @androidx.camera.core.ExperimentalGetImage
    private fun captureEyeImages(imageProxy: ImageProxy, face: com.google.mlkit.vision.face.Face) {
        try {
            Log.d(TAG, "👁️ captureEyeImages() called")
            val leftEye = face.getLandmark(FaceLandmark.LEFT_EYE)
            val rightEye = face.getLandmark(FaceLandmark.RIGHT_EYE)
            
            if (leftEye == null || rightEye == null) {
                Log.w(TAG, "⚠️ Eye landmarks not detected (left: ${leftEye != null}, right: ${rightEye != null})")
                return
            }
            
            Log.d(TAG, "👁️ Both eye landmarks detected, converting image...")
            
            // Convert ImageProxy to Bitmap
            val bitmap = imageProxyToBitmap(imageProxy)
            if (bitmap == null) {
                Log.e(TAG, "❌ Failed to convert ImageProxy to Bitmap")
                return
            }
            
            Log.d(TAG, "✅ Image converted to Bitmap (${bitmap.width}x${bitmap.height})")
            
            val timestamp = System.currentTimeMillis()
            
            // Extract and save left eye region
            val leftEyeBitmap = extractEyeRegion(bitmap, leftEye.position, face.boundingBox)
            if (leftEyeBitmap != null) {
                Log.d(TAG, "📸 Saving left eye image...")
                saveEyeImage(leftEyeBitmap, "${timestamp}_left_eye.jpg")
                leftEyeBitmap.recycle()
            } else {
                Log.w(TAG, "⚠️ Failed to extract left eye region")
            }
            
            // Extract and save right eye region
            val rightEyeBitmap = extractEyeRegion(bitmap, rightEye.position, face.boundingBox)
            if (rightEyeBitmap != null) {
                Log.d(TAG, "📸 Saving right eye image...")
                saveEyeImage(rightEyeBitmap, "${timestamp}_right_eye.jpg")
                rightEyeBitmap.recycle()
            } else {
                Log.w(TAG, "⚠️ Failed to extract right eye region")
            }
            
            bitmap.recycle()
            Log.d(TAG, "👁️✅ Eye images captured successfully!")
            
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to capture eye images", e)
        }
    }

    @androidx.camera.core.ExperimentalGetImage
    private fun imageProxyToBitmap(imageProxy: ImageProxy): Bitmap? {
        try {
            val image = imageProxy.image ?: return null
            
            // Convert YUV_420_888 to RGB bitmap
            val yBuffer = image.planes[0].buffer
            val uBuffer = image.planes[1].buffer
            val vBuffer = image.planes[2].buffer

            val ySize = yBuffer.remaining()
            val uSize = uBuffer.remaining()
            val vSize = vBuffer.remaining()

            val nv21 = ByteArray(ySize + uSize + vSize)
            yBuffer.get(nv21, 0, ySize)
            vBuffer.get(nv21, ySize, vSize)
            uBuffer.get(nv21, ySize + vSize, uSize)

            val yuvImage = android.graphics.YuvImage(nv21, android.graphics.ImageFormat.NV21, image.width, image.height, null)
            val out = java.io.ByteArrayOutputStream()
            yuvImage.compressToJpeg(android.graphics.Rect(0, 0, image.width, image.height), 100, out)
            val imageBytes = out.toByteArray()
            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
            
            // Rotate and mirror bitmap for front camera
            val matrix = Matrix()
            matrix.postRotate(imageProxy.imageInfo.rotationDegrees.toFloat())
            matrix.preScale(-1f, 1f) // Mirror for front camera
            
            val rotatedBitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            
            // Recycle original bitmap to prevent memory leak
            if (rotatedBitmap != bitmap) {
                bitmap.recycle()
            }
            
            return rotatedBitmap
        } catch (e: Exception) {
            Log.e(TAG, "Failed to convert ImageProxy to Bitmap", e)
            return null
        }
    }

    private fun extractEyeRegion(
        bitmap: Bitmap,
        eyePosition: android.graphics.PointF,
        faceBounds: Rect
    ): Bitmap? {
        try {
            // Calculate eye region with padding
            val eyeSize = (faceBounds.width() * 0.2f).toInt() // Eye region is ~20% of face width
            val padding = (eyeSize * 0.3f).toInt() // 30% padding
            
            val left = (eyePosition.x - eyeSize / 2 - padding).toInt().coerceIn(0, bitmap.width)
            val top = (eyePosition.y - eyeSize / 2 - padding).toInt().coerceIn(0, bitmap.height)
            val right = (eyePosition.x + eyeSize / 2 + padding).toInt().coerceIn(0, bitmap.width)
            val bottom = (eyePosition.y + eyeSize / 2 + padding).toInt().coerceIn(0, bitmap.height)
            
            val width = right - left
            val height = bottom - top
            
            if (width <= 0 || height <= 0) {
                Log.w(TAG, "Invalid eye region dimensions")
                return null
            }
            
            return Bitmap.createBitmap(bitmap, left, top, width, height)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to extract eye region", e)
            return null
        }
    }

    private fun saveEyeImage(bitmap: Bitmap, filename: String) {
        try {
            val directory = eyeCaptureDirectory ?: run {
                Log.e(TAG, "❌ Eye capture directory is null, cannot save image")
                return
            }
            
            val file = File(directory, filename)
            
            FileOutputStream(file).use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)
            }
            
            Log.d(TAG, "✅ Saved eye image: ${file.absolutePath}")
            Log.d(TAG, "📁 File exists: ${file.exists()}, Size: ${file.length()} bytes")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to save eye image: $filename", e)
        }
    }

    private fun stopCamera() {
        try {
            camera = null
            detectionJob?.cancel()
            cameraExecutor?.shutdown()
            cameraExecutor = null
            Log.d(TAG, "Camera stopped successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping camera", e)
        }
    }

    @ReactMethod
    fun extractEyeRegionsFromPhoto(photoUri: String, promise: Promise) {
        Log.d(TAG, "📸 extractEyeRegionsFromPhoto called with URI: $photoUri")
        
        CoroutineScope(Dispatchers.IO).launch {
            var bitmap: Bitmap? = null
            var faceDetectorClient: com.google.mlkit.vision.face.FaceDetector? = null
            
            try {
                // Load the image
                bitmap = BitmapFactory.decodeFile(photoUri.replace("file://", ""))
                if (bitmap == null) {
                    withContext(Dispatchers.Main) {
                        promise.reject("IMAGE_LOAD_ERROR", "Failed to load image from URI")
                    }
                    return@launch
                }
                
                Log.d(TAG, "✅ Image loaded: ${bitmap.width}x${bitmap.height}")
                
                // Detect face
                val inputImage = InputImage.fromBitmap(bitmap, 0)
                faceDetectorClient = FaceDetection.getClient(faceDetectorOptions)
                
                val task = faceDetectorClient.process(inputImage)
                val faces = com.google.android.gms.tasks.Tasks.await(task)
                
                if (faces.isEmpty()) {
                    Log.w(TAG, "❌ No face detected in image")
                    withContext(Dispatchers.Main) {
                        promise.reject("NO_FACE", "No face detected in the captured image")
                    }
                    return@launch
                }
                
                val face = faces[0]
                Log.d(TAG, "✅ Face detected: bounds=${face.boundingBox}")
                
                // Get eye landmarks
                val leftEyeLandmark = face.getLandmark(FaceLandmark.LEFT_EYE)
                val rightEyeLandmark = face.getLandmark(FaceLandmark.RIGHT_EYE)
                
                if (leftEyeLandmark == null || rightEyeLandmark == null) {
                    Log.w(TAG, "❌ Eye landmarks not detected")
                    withContext(Dispatchers.Main) {
                        promise.reject("NO_EYES", "Could not detect eye landmarks")
                    }
                    return@launch
                }
                
                Log.d(TAG, "✅ Eye landmarks found - Left: ${leftEyeLandmark.position}, Right: ${rightEyeLandmark.position}")
                
                // Extract eye regions
                val leftEyeBitmap = extractEyeRegion(bitmap, leftEyeLandmark.position, face.boundingBox)
                val rightEyeBitmap = extractEyeRegion(bitmap, rightEyeLandmark.position, face.boundingBox)
                
                if (leftEyeBitmap == null || rightEyeBitmap == null) {
                    withContext(Dispatchers.Main) {
                        promise.reject("EXTRACTION_FAILED", "Failed to extract eye regions")
                    }
                    return@launch
                }
                
                // Save the eye images to cache
                val timestamp = System.currentTimeMillis()
                val cacheDir = reactContext.cacheDir
                val leftEyeFile = File(cacheDir, "left_eye_$timestamp.jpg")
                val rightEyeFile = File(cacheDir, "right_eye_$timestamp.jpg")
                
                // Save left eye
                FileOutputStream(leftEyeFile).use { out ->
                    leftEyeBitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)
                }
                
                // Save right eye
                FileOutputStream(rightEyeFile).use { out ->
                    rightEyeBitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)
                }
                
                Log.d(TAG, "✅ Eye images saved:")
                Log.d(TAG, "   Left: ${leftEyeFile.absolutePath} (${leftEyeFile.length()} bytes)")
                Log.d(TAG, "   Right: ${rightEyeFile.absolutePath} (${rightEyeFile.length()} bytes)")
                
                // Return the file paths
                val result = Arguments.createMap().apply {
                    putString("leftEyeUri", "file://${leftEyeFile.absolutePath}")
                    putString("rightEyeUri", "file://${rightEyeFile.absolutePath}")
                    putString("leftEyePath", leftEyeFile.absolutePath)
                    putString("rightEyePath", rightEyeFile.absolutePath)
                }
                
                withContext(Dispatchers.Main) {
                    promise.resolve(result)
                }
                
                // Cleanup
                leftEyeBitmap.recycle()
                rightEyeBitmap.recycle()
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error extracting eye regions", e)
                withContext(Dispatchers.Main) {
                    promise.reject("EXTRACTION_ERROR", e.message, e)
                }
            } finally {
                bitmap?.recycle()
                faceDetectorClient?.close()
            }
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        stopCamera()
        faceDetector.close()
    }
}
