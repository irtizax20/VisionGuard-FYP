package com.wajahat001.blinkfit

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import java.util.*

class ScreenStateReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val prefs = context.getSharedPreferences("ScreenTimeTracker", Context.MODE_PRIVATE)
        
        Log.d("ScreenStateReceiver", "⚡ Received intent: ${intent.action}")
        
        when (intent.action) {
            Intent.ACTION_SCREEN_ON -> {
                handleScreenOn(prefs)
            }
            Intent.ACTION_USER_PRESENT -> {
                // User unlocked the device: reliably resume counting
                handleScreenOn(prefs)
            }
            Intent.ACTION_SCREEN_OFF -> {
                handleScreenOff(context, prefs)
            }
        }
    }

    private fun handleScreenOn(prefs: SharedPreferences) {
        val now = System.currentTimeMillis()
        
        // CRITICAL: Move any pending seconds to total BEFORE starting new session
        // This ensures continuous counting across screen ON/OFF cycles
        val pendingSeconds = prefs.getLong("pendingSeconds", 0)
        if (pendingSeconds > 0) {
            val currentTotal = prefs.getLong("totalSecondsToday", 0)
            val newTotal = currentTotal + pendingSeconds
            Log.d("ScreenTimeTracker", "Screen ON: Moving $pendingSeconds pending seconds to total (${currentTotal}s -> ${newTotal}s)")
            prefs.edit().apply {
                putLong("totalSecondsToday", newTotal)
                putLong("pendingSeconds", 0)
                putBoolean("needsSync", true)
                apply()
            }
        }
        
        prefs.edit().apply {
            putLong("lastScreenOnTime", now)
            putBoolean("isScreenOn", true)
            apply()
        }
        
        Log.d("ScreenTimeTracker", "Screen ON at ${Date(now)}")
    }

    private fun handleScreenOff(context: Context, prefs: SharedPreferences) {
        // FIXED: Only check if we have a valid lastScreenOnTime
        // Don't check isScreenOn flag because it might be stale
        val lastScreenOnTime = prefs.getLong("lastScreenOnTime", 0)
        if (lastScreenOnTime == 0L) {
            Log.d("ScreenTimeTracker", "Screen OFF but no lastScreenOnTime - skipping (screen was already off)")
            return
        }
        
        val now = System.currentTimeMillis()
        val sessionDurationMillis = now - lastScreenOnTime
        val sessionDurationSeconds = sessionDurationMillis / 1000

        // Only count sessions that are at least 5 seconds to avoid false triggers
        // (like turning phone off/on, switching apps momentarily, etc.)
        if (sessionDurationSeconds < 5) {
            Log.d("ScreenTimeTracker", "Screen OFF but session too short ($sessionDurationSeconds sec), ignoring")
            prefs.edit().putBoolean("isScreenOn", false).apply()
            return
        }
        
        Log.d("ScreenTimeTracker", "Screen OFF. Session duration: $sessionDurationSeconds seconds")
        
        // Store in seconds, not minutes
        val currentTotal = prefs.getLong("pendingSeconds", 0)
        val newTotal = currentTotal + sessionDurationSeconds

        prefs.edit().apply {
            putLong("pendingSeconds", newTotal)
            putBoolean("isScreenOn", false)
            putBoolean("needsSync", true)
            apply()
        }

        try {
            // Ask foreground service to sync immediately; if offline, RN will queue on next run
            val intent = Intent(context, ScreenTimeService::class.java).apply {
                action = ScreenTimeService.ACTION_SYNC_NOW
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            Log.d("ScreenTimeTracker", "Requested immediate sync via service after screen OFF")
        } catch (e: Exception) {
            Log.e("ScreenTimeTracker", "Failed to request immediate sync", e)
        }

        Log.d("ScreenTimeTracker", "Added $sessionDurationSeconds sec. Total pending: $newTotal sec")
    }
}

