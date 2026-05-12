package com.wajahat001.blinkfit

import android.app.*
import android.app.ActivityManager.RunningAppProcessInfo
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.PowerManager
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import androidx.core.app.NotificationCompat
import java.text.SimpleDateFormat
import java.util.*
import kotlin.concurrent.fixedRateTimer

class ScreenTimeService : Service(), TextToSpeech.OnInitListener {

    companion object {
        const val ACTION_SYNC_NOW = "com.wajahat001.blinkfit.SYNC_NOW"
        const val ACTION_UPDATE_INTERVAL = "com.wajahat001.blinkfit.UPDATE_INTERVAL"
    }

    private var syncTimer: Timer? = null
    private var breakReminderTimer: Timer? = null
    private var tts: TextToSpeech? = null
    private var lastBreakReminderSeconds: Long = 0  // Track screen time when last reminder was shown
    private var wakeLock: PowerManager.WakeLock? = null
    
    // Helper function to check if app is in foreground
    private fun isAppInForeground(): Boolean {
        val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val appProcesses = activityManager.runningAppProcesses ?: return false
        
        val packageName = packageName
        for (appProcess in appProcesses) {
            if (appProcess.importance == RunningAppProcessInfo.IMPORTANCE_FOREGROUND &&
                appProcess.processName == packageName) {
                return true
            }
        }
        return false
    }
    
    private val CHANNEL_ID = "ScreenTimeTrackerChannel"
    private val BREAK_CHANNEL_ID = "ScreenBreakReminderChannel"
    private val NOTIFICATION_ID = 1001
    private val BREAK_NOTIFICATION_ID = 1002

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        // Acquire partial wake lock to keep timers running
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "BlinkFit::ScreenTimeWakeLock"
        )
        // Acquire with 10 minute timeout (will be renewed periodically)
        wakeLock?.acquire(10 * 60 * 1000L)
        Log.d("ScreenTimeService", "WakeLock acquired with 10-minute timeout")

        // Initialize TextToSpeech
        tts = TextToSpeech(this, this)

        // Mark service as running
        try {
            val prefs = getSharedPreferences("ScreenTimeTracker", Context.MODE_PRIVATE)
            prefs.edit().putBoolean("isServiceActive", true).apply()
            
            // Initialize last break reminder seconds from current screen time
            val totalSecondsToday = prefs.getLong("totalSecondsToday", 0)
            lastBreakReminderSeconds = totalSecondsToday
            Log.d("ScreenTimeService", "Initialized break reminder at $lastBreakReminderSeconds seconds")
        } catch (e: Exception) {
            Log.e("ScreenTimeService", "Error marking service active", e)
        }

        // Android 14+ (API 34+) requires foreground service type to be specified
        // Note: Build.VERSION_CODES.UPSIDE_DOWN_CAKE = 34 (Android 14)
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                startForeground(
                    NOTIFICATION_ID,
                    createNotification(),
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
                Log.d("ScreenTimeService", "✅ Foreground service started with DATA_SYNC type (Android 14+)")
            } catch (e: Exception) {
                Log.e("ScreenTimeService", "❌ Failed to start foreground with type, falling back to legacy", e)
                startForeground(NOTIFICATION_ID, createNotification())
            }
        } else {
            startForeground(NOTIFICATION_ID, createNotification())
            Log.d("ScreenTimeService", "✅ Foreground service started (legacy mode)")
        }
        
        startPeriodicSync()
        startBreakReminderCheck()
        
        Log.d("ScreenTimeService", "Service created and started")
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            // Read language preference from SharedPreferences
            val prefs = getSharedPreferences("TTSSettings", Context.MODE_PRIVATE)
            val language = prefs.getString("tts_language", "english") ?: "english"
            
            val locale = when (language) {
                "urdu" -> Locale("ur", "PK")
                else -> Locale.US
            }
            
            Log.d("ScreenTimeService", "🌍 Setting TTS language to: $language")
            
            val result = tts?.setLanguage(locale)
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                Log.e("ScreenTimeService", "TTS language not supported: $language")
            } else {
                // Set audio stream to ALARM to work in background
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                        Log.d("ScreenTimeService", "TTS started speaking")
                    }

                    override fun onDone(utteranceId: String?) {
                        Log.d("ScreenTimeService", "TTS finished speaking")
                    }

                    override fun onError(utteranceId: String?) {
                        Log.e("ScreenTimeService", "TTS error occurred")
                    }
                })
                Log.d("ScreenTimeService", "TTS initialized successfully with locale: ${locale.displayLanguage}")
            }
        } else {
            Log.e("ScreenTimeService", "TTS initialization failed")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            when (intent?.action) {
                ACTION_SYNC_NOW -> {
                    Log.d("ScreenTimeService", "Received ACTION_SYNC_NOW - syncing immediately")
                    syncToFirebase()
                }
                ACTION_UPDATE_INTERVAL -> {
                    Log.d("ScreenTimeService", "Received ACTION_UPDATE_INTERVAL - restarting break timer")
                    restartBreakReminderCheck()
                }
            }
        } catch (e: Exception) {
            Log.e("ScreenTimeService", "Error handling onStartCommand", e)
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            // Low priority channel for foreground service notification
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Screen Time Tracker",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Tracking your screen time in background"
                setShowBadge(false)
            }
            notificationManager.createNotificationChannel(serviceChannel)

            // High priority channel for break reminders
            val breakChannel = NotificationChannel(
                BREAK_CHANNEL_ID,
                "Screen Break Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Reminds you to take screen breaks"
                setShowBadge(true)
                enableVibration(true)
                enableLights(true)
            }
            notificationManager.createNotificationChannel(breakChannel)
        }
    }

    private fun createNotification(): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 
            0, 
            notificationIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) 
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            else 
                PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("BlinkFit Screen Time Tracker")
            .setContentText("Tracking your screen time...")
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun startPeriodicSync() {
        // Sync every 60 seconds
        syncTimer = fixedRateTimer("ScreenTimeSyncTimer", false, 0L, 60 * 1000L) {
            syncToFirebase()
        }
    }

    private fun syncToFirebase() {
        try {
            val prefs = getSharedPreferences("ScreenTimeTracker", Context.MODE_PRIVATE)
            
            val pendingSeconds = prefs.getLong("pendingSeconds", 0)
            
            if (pendingSeconds == 0L) {
                Log.d("ScreenTimeService", "No pending seconds to sync")
                return
            }

            // Move pending seconds to total and set sync flag
            // React Native will handle Firebase sync
            val currentTotal = prefs.getLong("totalSecondsToday", 0)
            val newTotal = currentTotal + pendingSeconds
            
            prefs.edit().apply {
                putLong("totalSecondsToday", newTotal)
                putLong("pendingSeconds", 0)
                putLong("lastSyncTime", System.currentTimeMillis())
                putBoolean("needsSync", true)
                apply()
            }
            
            Log.d("ScreenTimeService", "Accumulated $pendingSeconds seconds. Total today: $newTotal sec. React Native will sync to Firebase.")

        } catch (e: Exception) {
            Log.e("ScreenTimeService", "Error in syncToFirebase: ${e.message}")
        }
    }

    private fun startBreakReminderCheck() {
        // Check every 60 seconds if break reminder is needed
        breakReminderTimer = fixedRateTimer("BreakReminderTimer", false, 0L, 60 * 1000L) {
            // Only renew WakeLock if screen is ON
            val prefs = getSharedPreferences("ScreenTimeTracker", Context.MODE_PRIVATE)
            val isScreenOn = prefs.getBoolean("isScreenOn", false)
            
            if (isScreenOn) {
                wakeLock?.let {
                    if (!it.isHeld) {
                        it.acquire(10 * 60 * 1000L)
                        Log.d("ScreenTimeService", "WakeLock renewed (screen ON)")
                    }
                }
            }
            
            Log.d("ScreenTimeService", "⏰ Timer tick - calling checkBreakReminder()")
            checkBreakReminder()
        }
        Log.d("ScreenTimeService", "✅ Break reminder timer started (checking every 60s)")
    }

    private fun restartBreakReminderCheck() {
        breakReminderTimer?.cancel()
        breakReminderTimer = null
        
        // Reset last break reminder to current screen time
        val prefs = getSharedPreferences("ScreenTimeTracker", Context.MODE_PRIVATE)
        val totalSecondsToday = prefs.getLong("totalSecondsToday", 0)
        lastBreakReminderSeconds = totalSecondsToday
        
        startBreakReminderCheck()
        Log.d("ScreenTimeService", "Break reminder timer restarted at $lastBreakReminderSeconds seconds")
    }

    private var last20MinReminderSeconds: Long = 0
    private var last60MinReminderSeconds: Long = 0
    private var last120MinReminderSeconds: Long = 0
    
    private var screenLockView: ScreenLockView? = null

    // Rest of class... (wait, the prompt allows me to replace a chunk)

    private fun checkBreakReminder() {
        try {
            Log.d("ScreenTimeService", "🔍 checkBreakReminder() called")
            val prefs = getSharedPreferences("ScreenTimeTracker", Context.MODE_PRIVATE)
            
            // CRITICAL: Check if screen is currently ON - skip everything if screen is OFF
            val isScreenOn = prefs.getBoolean("isScreenOn", false)
            if (!isScreenOn) {
                Log.d("ScreenTimeService", "Screen is OFF - skipping break reminder check")
                return
            }
            
            // Get current total screen time in seconds
            val totalSecondsToday = prefs.getLong("totalSecondsToday", 0)
            var pendingSeconds = prefs.getLong("pendingSeconds", 0)
            
            // Calculate live pending seconds from current session
            val lastScreenOnTime = prefs.getLong("lastScreenOnTime", 0)
            if (lastScreenOnTime > 0) {
                val now = System.currentTimeMillis()
                val currentSessionSeconds = (now - lastScreenOnTime) / 1000
                // Add current session to pending (don't modify SharedPreferences yet)
                pendingSeconds += currentSessionSeconds
            }
            
            val currentScreenTimeSeconds = totalSecondsToday + pendingSeconds
            
            // Initialize last reminder times if they are 0
            if (last20MinReminderSeconds == 0L) last20MinReminderSeconds = currentScreenTimeSeconds
            if (last60MinReminderSeconds == 0L) last60MinReminderSeconds = currentScreenTimeSeconds
            if (last120MinReminderSeconds == 0L) last120MinReminderSeconds = currentScreenTimeSeconds

            val secSince20Min = currentScreenTimeSeconds - last20MinReminderSeconds
            val secSince60Min = currentScreenTimeSeconds - last60MinReminderSeconds
            val secSince120Min = currentScreenTimeSeconds - last120MinReminderSeconds

            Log.d("ScreenTimeService", "Screen time: ${currentScreenTimeSeconds}s, Since 20m: ${secSince20Min}s, Since 60m: ${secSince60Min}s, Since 120m: ${secSince120Min}s")

            // Check 120 minutes (7200 seconds)
            if (secSince120Min >= 7200) {
                Log.d("ScreenTimeService", "✅ 120-minute threshold reached! Forcing 5-minute screen lock.")
                last120MinReminderSeconds = currentScreenTimeSeconds
                // Also reset lower timers so they don't fire immediately after lock
                last60MinReminderSeconds = currentScreenTimeSeconds
                last20MinReminderSeconds = currentScreenTimeSeconds
                
                showScreenLock()
                return
            }
            
            // Check 60 minutes (3600 seconds)
            if (secSince60Min >= 3600) {
                Log.d("ScreenTimeService", "✅ 60-minute threshold reached! Reminding to take a rest.")
                last60MinReminderSeconds = currentScreenTimeSeconds
                // Reset lower timer
                last20MinReminderSeconds = currentScreenTimeSeconds
                
                showBreakReminder("rest")
                return
            }
            
            // Check 20 minutes (1200 seconds)
            if (secSince20Min >= 1200) {
                Log.d("ScreenTimeService", "✅ 20-minute threshold reached! Reminding to look around.")
                last20MinReminderSeconds = currentScreenTimeSeconds
                
                showBreakReminder("look_around")
                return
            }
            
        } catch (e: Exception) {
            Log.e("ScreenTimeService", "Error checking break reminder", e)
        }
    }

    private fun showScreenLock() {
        // Initialize screenLockView if needed
        if (screenLockView == null) {
            screenLockView = ScreenLockView(this)
        }
        
        // Show lock screen for 5 minutes
        screenLockView?.showLockScreen(5)
        speakBreakReminder("lock")
    }

    private fun showBreakReminder(type: String) {
        try {
            Log.d("ScreenTimeService", "🔔 showBreakReminder($type) called")
            
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            val isScreenOn = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
                powerManager.isInteractive
            } else {
                @Suppress("DEPRECATION")
                powerManager.isScreenOn
            }

            // Check if app is in foreground
            val isInForeground = isAppInForeground()
            
            // Always show notification
            showBreakNotification(type)

            // Play voice alert ONLY if screen is ON AND app is NOT in foreground
            if (isScreenOn && !isInForeground) {
                speakBreakReminder(type)
            }
        } catch (e: Exception) {
            Log.e("ScreenTimeService", "Error showing break reminder", e)
        }
    }

    private fun showBreakNotification(type: String) {
        try {
            val notificationIntent = Intent(this, MainActivity::class.java)
            val pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                else
                    PendingIntent.FLAG_UPDATE_CURRENT
            )

            val title = if (type == "look_around") "20-20-20 Rule! 👀" else "Time for a Rest! 🛌"
            val text = if (type == "look_around") "You've been looking at the screen for 20 minutes. Look 20 feet away for 20 seconds!" else "It's been an hour. Please rest your eyes."

            val notification = NotificationCompat.Builder(this, BREAK_CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setVibrate(longArrayOf(0, 500, 200, 500))
                .build()

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(BREAK_NOTIFICATION_ID, notification)
            
        } catch (e: Exception) {
            Log.e("ScreenTimeService", "Error showing break notification", e)
        }
    }

    private fun speakBreakReminder(type: String) {
        try {
            if (tts != null) {
                val prefs = getSharedPreferences("TTSSettings", Context.MODE_PRIVATE)
                val language = prefs.getString("tts_language", "english") ?: "english"
                
                var message = ""
                if (language == "urdu") {
                    message = when (type) {
                        "look_around" -> "اپنی آنکھیں اسکرین سے ہٹا کر ۲۰ فٹ دور دیکھیں۔"
                        "rest" -> "ایک گھنٹہ ہو گیا ہے۔ اپنی آنکھوں کو آرام دیں۔"
                        "lock" -> "دو گھنٹے ہو گئے ہیں۔ اب آپ کو آرام کرنا ہوگا۔"
                        else -> "ایک وقفہ لیں!"
                    }
                } else {
                    message = when (type) {
                        "look_around" -> "It has been 20 minutes. Please look around and blink your eyes."
                        "rest" -> "It has been an hour. Please take a rest."
                        "lock" -> "It has been 2 hours. Your screen is locked for 5 minutes. Please rest."
                        else -> "Time to take a screen break."
                    }
                }
                
                val params = Bundle()
                params.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_ALARM)
                params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "breakReminder_$type")
                
                tts?.speak(message, TextToSpeech.QUEUE_FLUSH, params, "breakReminder_$type")
            }
        } catch (e: Exception) {
            Log.e("ScreenTimeService", "Error speaking break reminder", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        syncTimer?.cancel()
        syncTimer = null
        
        breakReminderTimer?.cancel()
        breakReminderTimer = null

        // Release wake lock
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
                Log.d("ScreenTimeService", "WakeLock released")
            }
        }
        wakeLock = null

        // Shutdown TTS
        tts?.stop()
        tts?.shutdown()
        tts = null

        // Mark service as stopped in SharedPreferences
        try {
            val prefs = getSharedPreferences("ScreenTimeTracker", Context.MODE_PRIVATE)
            prefs.edit().putBoolean("isServiceActive", false).apply()
        } catch (e: Exception) {
            Log.e("ScreenTimeService", "Failed to update service status on destroy", e)
        }

        Log.d("ScreenTimeService", "Service destroyed")
    }
}
