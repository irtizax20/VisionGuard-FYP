package com.wajahat001.blinkfit

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.*
import java.text.SimpleDateFormat
import java.util.*

class ScreenTimeTrackerModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    private val screenReceiver = ScreenStateReceiver()
    private var isReceiverRegistered = false

    override fun getName(): String {
        return "ScreenTimeTracker"
    }

    @ReactMethod
    fun startTracking(promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences("ScreenTimeTracker", Context.MODE_PRIVATE)
            
            // Always register screen state receiver if not already registered
            if (!isReceiverRegistered) {
                val filter = IntentFilter().apply {
                    addAction(Intent.ACTION_SCREEN_ON)
                    addAction(Intent.ACTION_SCREEN_OFF)
                    addAction(Intent.ACTION_USER_PRESENT) // resume after unlock
                }
                context.registerReceiver(screenReceiver, filter)
                isReceiverRegistered = true
                Log.d("ScreenTimeTracker", "Screen state receiver registered")
            }
            
            // Check if already tracking and service is running
            val isAlreadyActive = prefs.getBoolean("isServiceActive", false)
            Log.d("ScreenTimeTracker", "startTracking() called - isServiceActive: $isAlreadyActive")
            
            if (isAlreadyActive) {
                // Already tracking - ensure service is running and update screen state
                val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                val isScreenActuallyOn = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
                    powerManager.isInteractive
                } else {
                    @Suppress("DEPRECATION")
                    powerManager.isScreenOn
                }
                
                // Update screen state if it's ON but not tracked
                val currentScreenOn = prefs.getBoolean("isScreenOn", false)
                val lastScreenOnTime = prefs.getLong("lastScreenOnTime", 0)
                Log.d("ScreenTimeTracker", "Screen state check - PowerManager says: $isScreenActuallyOn, SharedPrefs says: $currentScreenOn, lastScreenOnTime: $lastScreenOnTime")
                
                if (isScreenActuallyOn && (!currentScreenOn || lastScreenOnTime == 0L)) {
                    val now = System.currentTimeMillis()
                    prefs.edit().apply {
                        putLong("lastScreenOnTime", now)
                        putBoolean("isScreenOn", true)
                        apply()
                    }
                    Log.d("ScreenTimeTracker", "✅ FIXED: Updated screen state to ON at $now - resuming tracking")
                } else if (isScreenActuallyOn && currentScreenOn) {
                    Log.d("ScreenTimeTracker", "✓ Screen already tracked as ON - no update needed")
                } else if (!isScreenActuallyOn) {
                    Log.d("ScreenTimeTracker", "⚠️ Screen is actually OFF - tracking will resume when screen turns ON")
                }
                
                val serviceIntent = Intent(context, ScreenTimeService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
                Log.d("ScreenTimeTracker", "Tracking already active - service ensured, data preserved")
                promise.resolve(true)
                return
            }

            // First time starting - initialize tracking state
            val now = System.currentTimeMillis()
            val today = getTodayDateString()
            
            // Check if screen is actually ON right now using PowerManager
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            val isScreenActuallyOn = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
                powerManager.isInteractive
            } else {
                @Suppress("DEPRECATION")
                powerManager.isScreenOn
            }
            
            prefs.edit().apply {
                putLong("lastScreenOnTime", if (isScreenActuallyOn) now else 0)
                putBoolean("isScreenOn", isScreenActuallyOn)
                putBoolean("isServiceActive", true) // Mark tracking as active
                putString("lastSavedDate", today) // Set date on tracking start
                apply()
            }
            Log.d("ScreenTimeTracker", "First time tracking start - screen is ${if (isScreenActuallyOn) "ON" else "OFF"}, lastScreenOnTime: ${if (isScreenActuallyOn) now else 0}, initialized state")

            // Start foreground service
            val serviceIntent = Intent(context, ScreenTimeService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_ERROR", "Failed to start tracking: ${e.message}")
        }
    }

    @ReactMethod
    fun stopTracking(promise: Promise) {
        try {
            val context = reactApplicationContext
            
            // Mark tracking as inactive
            val prefs = context.getSharedPreferences("ScreenTimeTracker", Context.MODE_PRIVATE)
            prefs.edit().putBoolean("isServiceActive", false).apply()
            
            // Unregister receiver
            if (isReceiverRegistered) {
                try {
                    context.unregisterReceiver(screenReceiver)
                    isReceiverRegistered = false
                } catch (e: Exception) {
                    // Already unregistered
                }
            }

            // Stop service
            val serviceIntent = Intent(context, ScreenTimeService::class.java)
            context.stopService(serviceIntent)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", "Failed to stop tracking: ${e.message}")
        }
    }

    @ReactMethod
    fun getTodayScreenTime(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("ScreenTimeTracker", Context.MODE_PRIVATE)

            // Check if date has changed (midnight passed)
            val today = getTodayDateString()
            val lastSavedDate = prefs.getString("lastSavedDate", "")
            
            if (lastSavedDate != today) {
                // Check if we have data from Firestore (setTodayScreenTime was called)
                val totalSecondsToday = prefs.getLong("totalSecondsToday", 0)
                
                if (totalSecondsToday > 0) {
                    // Data exists from Firestore - just update date, DON'T reset
                    Log.d("ScreenTimeTracker", "Date changed but have Firestore data (${totalSecondsToday}s) - updating date only")
                    prefs.edit().putString("lastSavedDate", today).apply()
                    promise.resolve(totalSecondsToday.toInt())
                    return
                }
                
                // No data from Firestore - reset for new day
                Log.d("ScreenTimeTracker", "Date changed and no data - resetting to 0")
                prefs.edit().apply {
                    putLong("totalSecondsToday", 0)
                    putLong("pendingSeconds", 0)
                    putLong("lastScreenOnTime", 0)
                    putBoolean("isScreenOn", false)
                    putString("lastSavedDate", today)
                    apply()
                }
                promise.resolve(0)
                return
            }

            val totalSecondsToday = prefs.getLong("totalSecondsToday", 0)
            val pendingSeconds = prefs.getLong("pendingSeconds", 0)
            val isScreenOn = prefs.getBoolean("isScreenOn", false)
            val lastScreenOnTime = prefs.getLong("lastScreenOnTime", 0)

            Log.d("ScreenTimeTracker", "getTodayScreenTime - total: ${totalSecondsToday}s, pending: ${pendingSeconds}s, isScreenOn: $isScreenOn, lastScreenOnTime: $lastScreenOnTime")

            // Base seconds from persisted + pending
            var totalSeconds = totalSecondsToday + pendingSeconds

            // If screen is currently ON, add live session seconds from lastScreenOnTime until now
            if (isScreenOn && lastScreenOnTime != 0L) {
                val now = System.currentTimeMillis()
                val sessionDurationMillis = now - lastScreenOnTime
                // Round down to full seconds for consistent display
                val sessionSeconds = sessionDurationMillis / 1000
                if (sessionSeconds > 0) {
                    totalSeconds += sessionSeconds
                    Log.d("ScreenTimeTracker", "Adding live session: ${sessionSeconds}s (total now: ${totalSeconds}s)")
                }
            } else {
                Log.d("ScreenTimeTracker", "No live session - isScreenOn: $isScreenOn, lastScreenOnTime: $lastScreenOnTime")
            }

            // Return as integer (already in full seconds)
            promise.resolve(totalSeconds.toInt())
        } catch (e: Exception) {
            promise.reject("GET_ERROR", "Failed to get screen time: ${e.message}")
        }
    }


    @ReactMethod
    fun clearTodayScreenTime(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("ScreenTimeTracker", Context.MODE_PRIVATE)
            prefs.edit().apply {
                putLong("totalSecondsToday", 0)
                putLong("pendingSeconds", 0)
                putLong("lastScreenOnTime", 0)
                apply()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEAR_ERROR", "Failed to clear screen time: ${e.message}")
        }
    }

    /**
     * Set today's screen time (used when loading from Firestore)
     * This ensures native module continues counting from the fetched value
     */
    @ReactMethod
    fun setTodayScreenTime(seconds: Int, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("ScreenTimeTracker", Context.MODE_PRIVATE)
            val today = getTodayDateString()
            
            // CRITICAL: Set both totalSecondsToday AND lastSavedDate together
            // This ensures getTodayScreenTime() won't reset the value due to date mismatch
            prefs.edit().apply {
                putLong("totalSecondsToday", seconds.toLong())
                putString("lastSavedDate", today) // Update date FIRST to prevent reset
                putLong("pendingSeconds", 0) // Clear pending to avoid double counting
                // Don't reset lastScreenOnTime or isScreenOn - let tracking continue
                apply()
            }
            
            // Check if screen is ON but lastScreenOnTime is not set (resume tracking)
            val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            val isScreenActuallyOn = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
                powerManager.isInteractive
            } else {
                @Suppress("DEPRECATION")
                powerManager.isScreenOn
            }
            
            val lastScreenOnTime = prefs.getLong("lastScreenOnTime", 0)
            val isScreenOn = prefs.getBoolean("isScreenOn", false)
            Log.d("ScreenTimeTracker", "setTodayScreenTime - PowerManager: $isScreenActuallyOn, lastScreenOnTime: $lastScreenOnTime, isScreenOn: $isScreenOn")
            
            // ALWAYS update screen state if screen is actually ON (force resume)
            if (isScreenActuallyOn) {
                val now = System.currentTimeMillis()
                prefs.edit().apply {
                    putLong("lastScreenOnTime", now)
                    putBoolean("isScreenOn", true)
                    apply()
                }
                Log.d("ScreenTimeTracker", "✅ Screen is ON - forcing tracking resume at $now after setting ${seconds}s")
            } else {
                Log.d("ScreenTimeTracker", "⚠️ Screen is OFF - tracking will resume when screen turns ON")
            }
            
            Log.d("ScreenTimeTracker", "✅ Set today's screen time: ${seconds}s for date: $today")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_ERROR", "Failed to set screen time: ${e.message}")
        }
    }

    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        try {
            // Use SharedPreferences flag for reliable service status
            // (getRunningServices is deprecated and unreliable on Android 8+)
            val prefs = reactApplicationContext.getSharedPreferences("ScreenTimeTracker", Context.MODE_PRIVATE)
            val isActive = prefs.getBoolean("isServiceActive", false)
            promise.resolve(isActive)
        } catch (e: Exception) {
            Log.e("ScreenTimeTracker", "Failed to check service status", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val context = reactApplicationContext
                val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                val packageName = context.packageName
                val isIgnoring = pm.isIgnoringBatteryOptimizations(packageName)
                promise.resolve(isIgnoring)
            } else {
                // On older versions there is no battery optimization feature
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("BATTERY_OPT_ERROR", "Failed to check battery optimizations: ${e.message}")
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val context = reactApplicationContext
                val packageName = context.packageName
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = android.net.Uri.parse("package:$packageName")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("BATTERY_OPT_REQUEST_ERROR", "Failed to request ignore battery optimizations: ${e.message}")
        }
    }

    @Suppress("DEPRECATION")
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        if (isReceiverRegistered) {
            try {
                reactApplicationContext.unregisterReceiver(screenReceiver)
                isReceiverRegistered = false
            } catch (e: Exception) {
                // Already unregistered
            }
        }
    }
    
    /**
     * Get today's date in YYYY-MM-DD format for date comparison
     */
    private fun getTodayDateString(): String {
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        return dateFormat.format(Date())
    }
}
