package com.wajahat001.blinkfit

import android.content.Context
import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.*

class ScreenBreakModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "ScreenBreakModule"
    }

    @ReactMethod
    fun setBreakInterval(intervalMinutes: Int, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("ScreenTimeTracker", Context.MODE_PRIVATE)
            prefs.edit().putInt("breakIntervalMinutes", intervalMinutes).apply()
            
            // Notify service to restart break timer
            val serviceIntent = Intent(reactApplicationContext, ScreenTimeService::class.java)
            serviceIntent.action = ScreenTimeService.ACTION_UPDATE_INTERVAL
            reactApplicationContext.startService(serviceIntent)
            
            Log.d("ScreenBreakModule", "Break interval set to $intervalMinutes minutes")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("ScreenBreakModule", "Error setting break interval", e)
            promise.reject("ERROR", "Failed to set break interval: ${e.message}")
        }
    }

    @ReactMethod
    fun getBreakInterval(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("ScreenTimeTracker", Context.MODE_PRIVATE)
            val intervalMinutes = prefs.getInt("breakIntervalMinutes", 2) // Default 2 minutes (testing)
            
            Log.d("ScreenBreakModule", "Retrieved break interval: $intervalMinutes minutes")
            promise.resolve(intervalMinutes)
        } catch (e: Exception) {
            Log.e("ScreenBreakModule", "Error getting break interval", e)
            promise.reject("ERROR", "Failed to get break interval: ${e.message}")
        }
    }
}
