package com.wajahat001.blinkfit

import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class VisionGuardOverlayModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "VisionGuardOverlay"
    }

    @ReactMethod
    fun startOverlayService(promise: Promise) {
        val context = reactApplicationContext
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            promise.reject("PERMISSION_DENIED", "SYSTEM_ALERT_WINDOW permission is required")
            return
        }

        try {
            val intent = Intent(context, VisionGuardOverlayService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SERVICE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopOverlayService(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, VisionGuardOverlayService::class.java)
            context.stopService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SERVICE_ERROR", e.message)
        }
    }
}
