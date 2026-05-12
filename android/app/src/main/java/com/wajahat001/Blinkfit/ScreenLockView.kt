package com.wajahat001.blinkfit

import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.os.CountDownTimer
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import android.graphics.Color
import android.graphics.Typeface
import android.util.Log

class ScreenLockView(private val context: Context) {

    private var windowManager: WindowManager? = null
    private var lockView: View? = null
    var isLocked = false
        private set
    private var countdownTimer: CountDownTimer? = null

    init {
        windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    }

    fun showLockScreen(durationMinutes: Int) {
        if (isLocked) return
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            Log.e("ScreenLockView", "Cannot draw overlays! Permission not granted.")
            return
        }
        
        try {
            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) 
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY 
                else 
                    WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                PixelFormat.TRANSLUCENT
            )
            
            // To block everything including touches
            params.flags = WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or 
                           WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                           WindowManager.LayoutParams.FLAG_FULLSCREEN
                           
            params.gravity = Gravity.CENTER
            
            lockView = createView(context)
            
            windowManager?.addView(lockView, params)
            isLocked = true
            
            // Start countdown
            val timeText = lockView?.findViewById<TextView>(1001)
            val durationMillis = durationMinutes * 60 * 1000L
            
            countdownTimer = object : CountDownTimer(durationMillis, 1000) {
                override fun onTick(millisUntilFinished: Long) {
                    val minutes = millisUntilFinished / 1000 / 60
                    val seconds = (millisUntilFinished / 1000) % 60
                    timeText?.text = String.format("%02d:%02d", minutes, seconds)
                }

                override fun onFinish() {
                    unlockScreen()
                }
            }.start()
            Log.d("ScreenLockView", "Screen locked for $durationMinutes minutes.")
        } catch (e: Exception) {
            Log.e("ScreenLockView", "Error showing lock screen", e)
        }
    }

    fun unlockScreen() {
        if (!isLocked) return
        try {
            countdownTimer?.cancel()
            countdownTimer = null
            lockView?.let {
                windowManager?.removeView(it)
            }
            lockView = null
            isLocked = false
            Log.d("ScreenLockView", "Screen unlocked.")
        } catch (e: Exception) {
            Log.e("ScreenLockView", "Error unlocking screen", e)
        }
    }

    private fun createView(context: Context): View {
        val layout = LinearLayout(context)
        layout.orientation = LinearLayout.VERTICAL
        layout.gravity = Gravity.CENTER
        layout.setBackgroundColor(Color.parseColor("#E53935")) // Red background
        
        val titleParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        )
        titleParams.setMargins(0, 0, 0, 50)
        
        val titleText = TextView(context).apply {
            text = "Forced Rest Time"
            textSize = 36f
            setTextColor(Color.WHITE)
            setTypeface(null, Typeface.BOLD)
            layoutParams = titleParams
        }
        
        val descText = TextView(context).apply {
            text = "You have been using your device for 2 hours continuously.\n\nPlease rest your eyes for 5 minutes."
            textSize = 20f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(40, 0, 40, 80)
        }
        
        val timerText = TextView(context).apply {
            id = 1001
            text = "05:00"
            textSize = 56f
            setTextColor(Color.WHITE)
            setTypeface(null, Typeface.BOLD)
        }
        
        layout.addView(titleText)
        layout.addView(descText)
        layout.addView(timerText)
        
        // Block touches
        layout.setOnTouchListener { _, _ -> true }
        
        return layout
    }
}
