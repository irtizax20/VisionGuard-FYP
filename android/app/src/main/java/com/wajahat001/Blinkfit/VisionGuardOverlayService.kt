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
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.NotificationCompat
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
    // Actions
    private val ACTION_STOP = "com.wajahat001.blinkfit.STOP_OVERLAY"
    private val ACTION_HIDE_BUBBLE = "com.wajahat001.blinkfit.HIDE_BUBBLE"
    private val ACTION_SHOW_BUBBLE = "com.wajahat001.blinkfit.SHOW_BUBBLE"

    private lateinit var windowManager: WindowManager
    private lateinit var overlayView: View
    private lateinit var cameraExecutor: ExecutorService
    private var tts: TextToSpeech? = null
    private var isTtsReady = false
    private var isBubbleVisible = true

    // Throttling timestamps
    private var lastDistanceSpeakTime = 0L
    private var lastBlinkAlertTime = 0L
    private var lastFatigueAlertTime = 0L
    private val TTS_DISTANCE_THROTTLE_MS = 15_000L
    private val BLINK_ALERT_THROTTLE_MS = 60_000L
    private val FATIGUE_ALERT_INTERVAL_MS = 20 * 60_000L

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
            Log.d(TAG, "TTS initialized")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                Log.d(TAG, "Stop action received")
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_HIDE_BUBBLE -> {
                // Hide the floating bubble but keep monitoring
                if (isBubbleVisible && ::overlayView.isInitialized) {
                    overlayView.visibility = View.GONE
                    isBubbleVisible = false
                    // Update notification to show "Show" button instead
                    val nm = getSystemService(NotificationManager::class.java)
                    nm.notify(NOTIFICATION_ID, buildForegroundNotification())
                    Log.d(TAG, "Bubble hidden, monitoring continues")
                }
            }
            ACTION_SHOW_BUBBLE -> {
                // Re-show the floating bubble
                if (!isBubbleVisible && ::overlayView.isInitialized) {
                    overlayView.visibility = View.VISIBLE
                    isBubbleVisible = true
                    val nm = getSystemService(NotificationManager::class.java)
                    nm.notify(NOTIFICATION_ID, buildForegroundNotification())
                    Log.d(TAG, "Bubble shown again")
                }
            }
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

        // ✅ Close button is a SIBLING of drag_handle, not a child.
        // It freely receives its own click events — no touch interception from drag_handle.
        val closeButton = overlayView.findViewById<View>(R.id.btn_close_bubble)
        closeButton?.setOnClickListener {
            startService(Intent(this, VisionGuardOverlayService::class.java).apply {
                action = ACTION_HIDE_BUBBLE
            })
        }

        // ✅ Drag listener on drag_handle ONLY (the inner eye circle).
        // This does NOT interfere with btn_close_bubble which is a separate sibling view.
        val dragHandle = overlayView.findViewById<View>(R.id.drag_handle)
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f

        dragHandle?.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = layoutParams.x
                    initialY = layoutParams.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    layoutParams.x = initialX + (event.rawX - initialTouchX).toInt()
                    layoutParams.y = initialY + (event.rawY - initialTouchY).toInt()
                    windowManager.updateViewLayout(overlayView, layoutParams)
                    true
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
                cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageAnalyzer)
                Log.d(TAG, "Camera bound to lifecycle")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to bind camera", e)
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.camera.core.ExperimentalGetImage
    private fun processImage(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage == null) { imageProxy.close(); return }

        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        faceDetector.process(image)
            .addOnSuccessListener { faces ->
                if (faces.isNotEmpty()) {
                    val face = faces[0]

                    // 1. Distance check
                    val distance = calculateDistance(face, image.width)
                    if (distance != null && distance < 40f) handleTooClose(distance)

                    // 2. Blink tracking via EAR
                    val leftOpen  = (face.leftEyeOpenProbability  ?: 1f) > 0.5f
                    val rightOpen = (face.rightEyeOpenProbability ?: 1f) > 0.5f
                    if (previousLeftEyeOpen && !leftOpen && previousRightEyeOpen && !rightOpen) {
                        blinkCount++
                        Log.d(TAG, "👁️ Overlay blink #$blinkCount")
                    }
                    previousLeftEyeOpen  = leftOpen
                    previousRightEyeOpen = rightOpen

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
            .addOnCompleteListener { imageProxy.close() }
    }

    private fun handleTooClose(distance: Float) {
        val now = System.currentTimeMillis()
        if (now - lastDistanceSpeakTime > TTS_DISTANCE_THROTTLE_MS) {
            lastDistanceSpeakTime = now
            if (isTtsReady) tts?.speak("Please maintain a safe distance from the screen", TextToSpeech.QUEUE_FLUSH, null, "DIST")
            showAlertNotification("📏 Too Close!", "You are ${distance.toInt()} cm from screen. Move back to at least 40 cm.")
        }
    }

    private fun checkBlinkRate(blinks: Int) {
        if (blinks < MIN_BLINKS_PER_MINUTE) {
            val now = System.currentTimeMillis()
            if (now - lastBlinkAlertTime > BLINK_ALERT_THROTTLE_MS) {
                lastBlinkAlertTime = now
                if (isTtsReady) tts?.speak("You are not blinking enough. Please blink more.", TextToSpeech.QUEUE_FLUSH, null, "BLINK")
                showAlertNotification("👁️ Low Blink Rate!", "Only $blinks blinks/min detected. Aim for 15-20 blinks/min.")
            }
        }
    }

    private fun showFatigueAlert() {
        val mins = (System.currentTimeMillis() - serviceStartTime) / 60_000L
        if (isTtsReady) tts?.speak("You have been using the screen for $mins minutes. Please take a short break.", TextToSpeech.QUEUE_FLUSH, null, "FATIGUE")
        showAlertNotification("😴 Eye Fatigue!", "Screen time: $mins min. Take a 5-min break — look 20 feet away.")
    }

    private fun showAlertNotification(title: String, message: String) {
        try {
            val n = NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                .setContentTitle(title).setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true).build()
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .notify(ALERT_NOTIFICATION_ID + (Math.random() * 100).toInt(), n)
        } catch (e: Exception) { Log.e(TAG, "Alert notif error", e) }
    }

    private fun calculateDistance(face: com.google.mlkit.vision.face.Face, imageWidth: Int): Float? {
        val w = face.boundingBox.width().toFloat()
        if (w <= 0) return null
        return (15f * 500f) / w
    }

    private fun buildForegroundNotification() = NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("👁️ Vision Guard Active")
        .setContentText(if (isBubbleVisible) "Monitoring eye health • Tap to manage" else "Monitoring continues (bubble hidden)")
        .setSmallIcon(R.mipmap.ic_launcher)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        // Toggle bubble visibility button
        .addAction(
            android.R.drawable.ic_menu_view,
            if (isBubbleVisible) "Hide Bubble" else "Show Bubble",
            PendingIntent.getService(
                this, 1,
                Intent(this, VisionGuardOverlayService::class.java).apply {
                    action = if (isBubbleVisible) ACTION_HIDE_BUBBLE else ACTION_SHOW_BUBBLE
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        )
        // Full stop button
        .addAction(
            android.R.drawable.ic_menu_close_clear_cancel,
            "Stop Monitoring",
            PendingIntent.getService(
                this, 0,
                Intent(this, VisionGuardOverlayService::class.java).apply { action = ACTION_STOP },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        )
        .build()

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Vision Guard Service", NotificationManager.IMPORTANCE_LOW)
            )
            manager.createNotificationChannel(
                NotificationChannel(ALERT_CHANNEL_ID, "Vision Guard Alerts", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Alerts for distance, blink rate, and fatigue"
                    enableVibration(true)
                }
            )
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::windowManager.isInitialized && ::overlayView.isInitialized) {
            try { windowManager.removeView(overlayView) } catch (e: Exception) { }
        }
        tts?.stop(); tts?.shutdown()
        cameraExecutor.shutdown()
        Log.d(TAG, "Service stopped")
    }
}
