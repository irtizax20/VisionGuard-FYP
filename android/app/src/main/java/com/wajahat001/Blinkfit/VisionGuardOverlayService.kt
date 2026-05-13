package com.wajahat001.blinkfit

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.speech.tts.TextToSpeech
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class VisionGuardOverlayService : LifecycleService(), TextToSpeech.OnInitListener {

    private val TAG = "VisionGuardOverlay"
    private val NOTIFICATION_ID = 9992
    private val ALERT_NOTIFICATION_ID = 9993
    private val CHANNEL_ID = "VisionGuardOverlayChannel"
    private val ALERT_CHANNEL_ID = "VisionGuardAlertChannel"
    private val ACTION_STOP = "com.wajahat001.blinkfit.STOP_OVERLAY"

    private lateinit var windowManager: WindowManager
    private lateinit var overlayView: View
    private lateinit var cameraExecutor: ExecutorService
    private var tts: TextToSpeech? = null
    private var isTtsReady = false

    // Throttling timestamps
    private var lastDistanceSpeakTime = 0L
    private var lastBlinkAlertTime = 0L
    private var lastFatigueAlertTime = 0L
    private val TTS_DISTANCE_THROTTLE_MS = 15_000L  // 15 seconds between voice alerts
    private val BLINK_ALERT_THROTTLE_MS = 60_000L   // 1 minute between blink alerts
    private val FATIGUE_ALERT_INTERVAL_MS = 20 * 60_000L // 20 minutes

    // Blink tracking state
    private var blinkCount = 0
    private var lastBlinkWindowStart = System.currentTimeMillis()
    private var previousLeftEyeOpen = true
    private var previousRightEyeOpen = true
    private val MIN_BLINKS_PER_MINUTE = 8

    // Fatigue tracking
    private var serviceStartTime = 0L

    private var faceDetector = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
            .setMinFaceSize(0.15f)
            .build()
    )

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "onCreate: Service started")
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        cameraExecutor = Executors.newSingleThreadExecutor()
        tts = TextToSpeech(this, this)
        serviceStartTime = System.currentTimeMillis()

        createNotificationChannels()
        startForeground(NOTIFICATION_ID, buildForegroundNotification())

        showOverlay()
        startCamera()
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts?.language = Locale.US
            isTtsReady = true
            Log.d(TAG, "TTS initialized successfully")
        } else {
            Log.e(TAG, "TTS initialization failed")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            Log.d(TAG, "Stop action received from notification")
            stopSelf()
            return START_NOT_STICKY
        }
        return super.onStartCommand(intent, flags, startId)
    }

    @SuppressLint("InflateParams", "ClickableViewAccessibility")
    private fun showOverlay() {
        val layoutParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        )

        layoutParams.gravity = Gravity.TOP or Gravity.START
        layoutParams.x = 16
        layoutParams.y = 120

        overlayView = LayoutInflater.from(this).inflate(R.layout.layout_floating_bubble, null)

        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var moveDetected = false

        overlayView.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = layoutParams.x
                    initialY = layoutParams.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    moveDetected = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - initialTouchX).toInt()
                    val dy = (event.rawY - initialTouchY).toInt()
                    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moveDetected = true
                    layoutParams.x = initialX + dx
                    layoutParams.y = initialY + dy
                    windowManager.updateViewLayout(overlayView, layoutParams)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!moveDetected) {
                        // Single tap → show current status toast
                        android.widget.Toast.makeText(this, "👁️ Vision Guard Active\nDrag to move • Stop from notification", android.widget.Toast.LENGTH_SHORT).show()
                    }
                    false
                }
                else -> false
            }
        }

        windowManager.addView(overlayView, layoutParams)
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            try {
                val cameraProvider = cameraProviderFuture.get()
                val previewView = overlayView.findViewById<PreviewView>(R.id.hidden_preview)

                val preview = Preview.Builder().build()
                preview.setSurfaceProvider(previewView.surfaceProvider)

                val imageAnalyzer = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                    .also {
                        it.setAnalyzer(cameraExecutor) { imageProxy ->
                            processImage(imageProxy)
                        }
                    }

                val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    this, cameraSelector, preview, imageAnalyzer
                )

                Log.d(TAG, "Camera bound to lifecycle in background")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to bind camera use cases", e)
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.camera.core.ExperimentalGetImage
    private fun processImage(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }

        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        faceDetector.process(image)
            .addOnSuccessListener { faces ->
                if (faces.isNotEmpty()) {
                    val face = faces[0]

                    // 1. Distance check
                    val distance = calculateDistance(face, image.width)
                    if (distance != null && distance < 40f) {
                        handleTooClose(distance)
                    }

                    // 2. Blink tracking (EAR-based)
                    val leftEyeOpen = (face.leftEyeOpenProbability ?: 1f) > 0.5f
                    val rightEyeOpen = (face.rightEyeOpenProbability ?: 1f) > 0.5f

                    // Detect blink: was open, now closed
                    if (previousLeftEyeOpen && !leftEyeOpen && previousRightEyeOpen && !rightEyeOpen) {
                        blinkCount++
                        Log.d(TAG, "👁️ Blink detected! Total: $blinkCount")
                    }
                    previousLeftEyeOpen = leftEyeOpen
                    previousRightEyeOpen = rightEyeOpen

                    // Check blink rate every 60 seconds
                    val now = System.currentTimeMillis()
                    if (now - lastBlinkWindowStart >= 60_000L) {
                        checkBlinkRate(blinkCount)
                        blinkCount = 0
                        lastBlinkWindowStart = now
                    }

                    // 3. Fatigue check every 20 minutes
                    if (now - serviceStartTime >= FATIGUE_ALERT_INTERVAL_MS &&
                        now - lastFatigueAlertTime >= FATIGUE_ALERT_INTERVAL_MS) {
                        lastFatigueAlertTime = now
                        showFatigueAlert()
                    }
                }
            }
            .addOnCompleteListener {
                imageProxy.close()
            }
    }

    private fun handleTooClose(distance: Float) {
        val now = System.currentTimeMillis()
        if (now - lastDistanceSpeakTime > TTS_DISTANCE_THROTTLE_MS) {
            lastDistanceSpeakTime = now
            Log.w(TAG, "BACKGROUND WARNING: Too close! (${distance.toInt()} cm)")

            // Voice alert
            if (isTtsReady) {
                tts?.speak(
                    "Please maintain a safe distance from the screen",
                    TextToSpeech.QUEUE_FLUSH,
                    null,
                    "DISTANCE_WARN"
                )
            }

            // Notification alert
            showAlertNotification(
                "📏 Too Close to Screen!",
                "You are only ${distance.toInt()} cm from the screen. Please move back to at least 40 cm."
            )
        }
    }

    private fun checkBlinkRate(blinksInLastMinute: Int) {
        Log.d(TAG, "📊 Blink rate check: $blinksInLastMinute blinks in last 60 seconds")
        if (blinksInLastMinute < MIN_BLINKS_PER_MINUTE) {
            val now = System.currentTimeMillis()
            if (now - lastBlinkAlertTime > BLINK_ALERT_THROTTLE_MS) {
                lastBlinkAlertTime = now

                // Voice alert
                if (isTtsReady) {
                    tts?.speak(
                        "You are not blinking enough. Please blink more to keep your eyes moist.",
                        TextToSpeech.QUEUE_FLUSH,
                        null,
                        "BLINK_WARN"
                    )
                }

                // Notification
                showAlertNotification(
                    "👁️ Low Blink Rate Detected!",
                    "Only $blinksInLastMinute blinks in the last minute. Healthy blinking is 15-20 times/min. Remember to blink!"
                )
            }
        }
    }

    private fun showFatigueAlert() {
        val minutesActive = (System.currentTimeMillis() - serviceStartTime) / 60_000L
        Log.w(TAG, "😴 Fatigue alert after $minutesActive minutes of continuous use")

        if (isTtsReady) {
            tts?.speak(
                "You have been using the screen for $minutesActive minutes. Please take a short break and rest your eyes.",
                TextToSpeech.QUEUE_FLUSH,
                null,
                "FATIGUE_WARN"
            )
        }

        showAlertNotification(
            "😴 Eye Fatigue Warning!",
            "You've been on screen for $minutesActive minutes. Take a 5-minute break: look at something 20 feet away."
        )
    }

    private fun showAlertNotification(title: String, message: String) {
        try {
            val notification = NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .build()

            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.notify(ALERT_NOTIFICATION_ID + (Math.random() * 100).toInt(), notification)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to show alert notification", e)
        }
    }

    private fun calculateDistance(face: com.google.mlkit.vision.face.Face, imageWidth: Int): Float? {
        val faceBox = face.boundingBox
        val faceWidthPixels = faceBox.width().toFloat()
        if (faceWidthPixels <= 0) return null
        val focalLength = 500f
        val realFaceWidthCm = 15f
        return (realFaceWidthCm * focalLength) / faceWidthPixels
    }

    private fun buildForegroundNotification() = NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("👁️ Vision Guard Active")
        .setContentText("Monitoring eye health in background")
        .setSmallIcon(R.mipmap.ic_launcher)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .addAction(
            android.R.drawable.ic_menu_close_clear_cancel,
            "Stop",
            PendingIntent.getService(
                this,
                0,
                Intent(this, VisionGuardOverlayService::class.java).apply { action = ACTION_STOP },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        )
        .build()

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Low-priority channel for persistent service notification
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Vision Guard Background Service",
                NotificationManager.IMPORTANCE_LOW
            )

            // High-priority channel for health alerts
            val alertChannel = NotificationChannel(
                ALERT_CHANNEL_ID,
                "Vision Guard Health Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Alerts for screen distance, blink rate, and eye fatigue"
                enableVibration(true)
            }

            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
            manager.createNotificationChannel(alertChannel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::windowManager.isInitialized && ::overlayView.isInitialized) {
            try { windowManager.removeView(overlayView) } catch (e: Exception) { /* ignore */ }
        }
        tts?.stop()
        tts?.shutdown()
        cameraExecutor.shutdown()
        Log.d(TAG, "onDestroy: Service stopped")
    }
}
