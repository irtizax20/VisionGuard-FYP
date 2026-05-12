package com.wajahat001.blinkfit

import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.app.usage.UsageEvents
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.os.Build
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.*
import java.util.*

class UsageStatsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName(): String {
        return "UsageStatsModule"
    }

    @ReactMethod
    fun hasUsagePermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
                val endTime = System.currentTimeMillis()
                val beginTime = endTime - 1000 * 60 * 60 * 24 // 24 hours ago
                
                val usageStatsList = usageStatsManager.queryUsageStats(
                    UsageStatsManager.INTERVAL_DAILY,
                    beginTime,
                    endTime
                )
                
                // If we can query usage stats, we have permission
                val hasPermission = usageStatsList.isNotEmpty()
                promise.resolve(hasPermission)
            } else {
                // Usage stats not supported on versions below Lollipop
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check usage permission: ${e.message}")
        }
    }

    @ReactMethod
    fun requestUsagePermission(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to open usage settings: ${e.message}")
        }
    }

    private fun isSystemApp(packageName: String): Boolean {
        val systemPackages = listOf(
            "android",
            "com.android",
            "com.google.android.gms",
            "com.google.android.gsf",
            "com.samsung",
            "com.huawei",
            "com.xiaomi",
            "com.oppo",
            "com.vivo",
            "com.oneplus",
            "systemui",
            "launcher",
            "settings"
        )
        
        val lowerPackage = packageName.lowercase()
        return systemPackages.any { lowerPackage.contains(it) }
    }
    
    private fun shouldIgnoreApp(packageName: String): Boolean {
        // Only filter very specific system apps, be more permissive for user apps
        val exactIgnoredApps = listOf(
            "com.android.systemui",
            "com.android.launcher3",
            "com.android.settings",
            "android",
            "com.google.android.gms",
            "com.google.android.gsf",
            "com.sec.android.app.launcher",
            "com.miui.home",
            "com.huawei.android.launcher",
            "com.android.phone",
            "com.android.dialer",
            "com.android.packageinstaller"
        )
        
        // Check for exact matches or very specific system prefixes
        val isExactSystemApp = exactIgnoredApps.any { 
            packageName.equals(it, ignoreCase = true) || 
            packageName.startsWith("$it.", ignoreCase = true)
        }
        
        // Additional check for launcher apps
        val isLauncherApp = packageName.contains("launcher", ignoreCase = true) && 
                           (packageName.contains("android", ignoreCase = true) ||
                            packageName.contains("samsung", ignoreCase = true) ||
                            packageName.contains("xiaomi", ignoreCase = true) ||
                            packageName.contains("huawei", ignoreCase = true))
        
        return isExactSystemApp || isLauncherApp
    }
    
    private fun getAppNameFromPackage(packageName: String): String {
        // Map popular app package names to readable names
        val popularApps = mapOf(
            "com.instagram.android" to "Instagram",
            "com.google.android.youtube" to "YouTube",
            "com.facebook.katana" to "Facebook",
            "com.facebook.orca" to "Messenger",
            "com.whatsapp" to "WhatsApp",
            "com.twitter.android" to "Twitter", 
            "com.snapchat.android" to "Snapchat",
            "com.tiktok.musically" to "TikTok",
            "com.linkedin.android" to "LinkedIn",
            "com.pinterest" to "Pinterest",
            "com.reddit.frontpage" to "Reddit",
            "com.spotify.music" to "Spotify",
            "com.netflix.mediaclient" to "Netflix",
            "com.amazon.mShop.android.shopping" to "Amazon",
            "com.google.android.gm" to "Gmail",
            "com.google.android.apps.maps" to "Google Maps",
            "com.ubercab" to "Uber",
            "com.skype.raider" to "Skype",
            "com.viber.voip" to "Viber",
            "com.discord" to "Discord",
            "com.zhiliaoapp.musically" to "TikTok",
            "com.microsoft.teams" to "Microsoft Teams",
            "us.zoom.videomeetings" to "Zoom",
            "com.google.android.apps.photos" to "Google Photos",
            "com.adobe.reader" to "Adobe Reader",
            "com.dropbox.android" to "Dropbox",
            "com.google.android.apps.docs" to "Google Docs",
            "com.microsoft.office.word" to "Microsoft Word",
            "com.paypal.android.p2pmobile" to "PayPal",
            "com.google.android.calendar" to "Google Calendar"
        )
        
        return popularApps[packageName] ?: run {
            // Extract app name from package name as fallback
            val parts = packageName.split(".")
            val lastPart = parts.lastOrNull() ?: packageName
            
            // Convert camelCase to readable format
            lastPart.replace(Regex("([a-z])([A-Z])")) { "${it.groupValues[1]} ${it.groupValues[2]}" }
                   .split(" ")
                   .joinToString(" ") { word -> 
                       word.lowercase().replaceFirstChar { it.uppercase() }
                   }
        }
    }

    @RequiresApi(Build.VERSION_CODES.LOLLIPOP)
    @ReactMethod
    fun getUsageStats(startTime: Double, endTime: Double, promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            
            // Use more granular interval for better accuracy
            val usageStatsList = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_BEST,  // Changed from INTERVAL_DAILY for better accuracy
                startTime.toLong(),
                endTime.toLong()
            )

            android.util.Log.d("UsageStatsModule", "Total apps from system: ${usageStatsList.size}")
            android.util.Log.d("UsageStatsModule", "Time range: ${Date(startTime.toLong())} to ${Date(endTime.toLong())}")
            android.util.Log.d("UsageStatsModule", "Time range (ms): ${startTime.toLong()} to ${endTime.toLong()}")
            
            val usageStatsArray = WritableNativeArray()
            var totalProcessed = 0
            var filteredOut = 0
            var systemFiltered = 0

            for (usageStats in usageStatsList) {
                totalProcessed++
                
                // Skip system apps and launchers
                if (shouldIgnoreApp(usageStats.packageName)) {
                    systemFiltered++
                    continue
                }
                
                // Include apps with any meaningful usage (more than 5 seconds)
                // This ensures Instagram, YouTube, and other social apps are included
                if (usageStats.totalTimeInForeground > 5000) {
                    val usageMap = WritableNativeMap()
                    usageMap.putString("packageName", usageStats.packageName)
                    usageMap.putDouble("totalTimeInForeground", usageStats.totalTimeInForeground.toDouble())
                    usageMap.putDouble("firstTimeStamp", usageStats.firstTimeStamp.toDouble())
                    usageMap.putDouble("lastTimeStamp", usageStats.lastTimeStamp.toDouble())
                    usageMap.putDouble("lastTimeUsed", usageStats.lastTimeUsed.toDouble())
                    
                    // Add detailed timing information for debugging
                    val currentTime = System.currentTimeMillis()
                    val timeSinceLastUsed = currentTime - usageStats.lastTimeUsed
                    val timeSpan = usageStats.lastTimeStamp - usageStats.firstTimeStamp
                    
                    android.util.Log.d("UsageStatsModule", "Time details for ${usageStats.packageName}:")
                    android.util.Log.d("UsageStatsModule", "  - Total foreground: ${usageStats.totalTimeInForeground}ms")
                    android.util.Log.d("UsageStatsModule", "  - First timestamp: ${Date(usageStats.firstTimeStamp)}")
                    android.util.Log.d("UsageStatsModule", "  - Last timestamp: ${Date(usageStats.lastTimeStamp)}")
                    android.util.Log.d("UsageStatsModule", "  - Last used: ${Date(usageStats.lastTimeUsed)}")
                    android.util.Log.d("UsageStatsModule", "  - Time since last used: ${timeSinceLastUsed / 1000 / 60}min ago")
                    android.util.Log.d("UsageStatsModule", "  - Session span: ${timeSpan / 1000 / 60}min")
                    
                    // Add app name with better fallback for popular apps
                    try {
                        val packageManager = reactApplicationContext.packageManager
                        val applicationInfo = packageManager.getApplicationInfo(usageStats.packageName, 0)
                        val appName = packageManager.getApplicationLabel(applicationInfo).toString()
                        usageMap.putString("appName", appName)
                        
                        // Log all user apps for debugging
                        val minutes = usageStats.totalTimeInForeground / 1000 / 60
                        val seconds = (usageStats.totalTimeInForeground / 1000) % 60
                        android.util.Log.d("UsageStatsModule", "User app: $appName (${usageStats.packageName}) - ${minutes}m ${seconds}s")
                    } catch (e: Exception) {
                        // App might be uninstalled, use enhanced fallback
                        val fallbackName = getAppNameFromPackage(usageStats.packageName)
                        usageMap.putString("appName", fallbackName)
                        android.util.Log.d("UsageStatsModule", "Unknown app with fallback: $fallbackName (${usageStats.packageName})")
                    }
                    
                    usageStatsArray.pushMap(usageMap)
                } else {
                    filteredOut++
                }
            }

            android.util.Log.d("UsageStatsModule", "Stats: Total=$totalProcessed, SystemFiltered=$systemFiltered, TimeFiltered=$filteredOut, Final=${usageStatsArray.size()}")
            promise.resolve(usageStatsArray)
        } catch (e: Exception) {
            android.util.Log.e("UsageStatsModule", "Error getting usage stats", e)
            promise.reject("ERROR", "Failed to get usage stats: ${e.message}")
        }
    }

    @RequiresApi(Build.VERSION_CODES.LOLLIPOP)
    @ReactMethod
    fun getAccurateUsageStats(startTime: Double, endTime: Double, promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            
            // Try to get usage events for more accurate timing
            val usageEvents = usageStatsManager.queryEvents(startTime.toLong(), endTime.toLong())
            val appSessionMap = mutableMapOf<String, Long>()
            val appLastResumeTime = mutableMapOf<String, Long>()
            
            android.util.Log.d("UsageStatsModule", "Processing usage events for accurate timing...")
            
            // Process usage events to calculate accurate foreground time
            while (usageEvents.hasNextEvent()) {
                val event = UsageEvents.Event()
                usageEvents.getNextEvent(event)
                
                when (event.eventType) {
                    UsageEvents.Event.ACTIVITY_RESUMED -> {
                        appLastResumeTime[event.packageName] = event.timeStamp
                    }
                    UsageEvents.Event.ACTIVITY_PAUSED -> {
                        val resumeTime = appLastResumeTime[event.packageName]
                        if (resumeTime != null) {
                            val sessionTime = event.timeStamp - resumeTime
                            appSessionMap[event.packageName] = (appSessionMap[event.packageName] ?: 0) + sessionTime
                        }
                    }
                }
            }
            
            // For apps still in foreground, calculate time from last resume to now
            val currentTime = System.currentTimeMillis()
            for ((packageName, resumeTime) in appLastResumeTime) {
                if (resumeTime > 0 && currentTime > resumeTime) {
                    val ongoingSession = currentTime - resumeTime
                    if (ongoingSession > 0 && ongoingSession < 3600000) { // Less than 1 hour (reasonable)
                        appSessionMap[packageName] = (appSessionMap[packageName] ?: 0) + ongoingSession
                    }
                }
            }
            
            android.util.Log.d("UsageStatsModule", "Calculated accurate sessions for ${appSessionMap.size} apps")
            
            // Convert to usage stats format
            val usageStatsArray = WritableNativeArray()
            
            for ((packageName, totalTime) in appSessionMap) {
                if (!shouldIgnoreApp(packageName) && totalTime > 5000) {
                    val usageMap = WritableNativeMap()
                    usageMap.putString("packageName", packageName)
                    usageMap.putDouble("totalTimeInForeground", totalTime.toDouble())
                    usageMap.putDouble("firstTimeStamp", startTime)
                    usageMap.putDouble("lastTimeStamp", endTime)
                    usageMap.putDouble("lastTimeUsed", appLastResumeTime[packageName]?.toDouble() ?: startTime)
                    
                    try {
                        val packageManager = reactApplicationContext.packageManager
                        val applicationInfo = packageManager.getApplicationInfo(packageName, 0)
                        val appName = packageManager.getApplicationLabel(applicationInfo).toString()
                        usageMap.putString("appName", appName)
                        
                        val minutes = totalTime / 1000 / 60
                        val seconds = (totalTime / 1000) % 60
                        android.util.Log.d("UsageStatsModule", "Accurate timing: $appName - ${minutes}m ${seconds}s (events-based)")
                    } catch (e: Exception) {
                        val fallbackName = getAppNameFromPackage(packageName)
                        usageMap.putString("appName", fallbackName)
                    }
                    
                    usageStatsArray.pushMap(usageMap)
                }
            }
            
            android.util.Log.d("UsageStatsModule", "Accurate stats completed: ${usageStatsArray.size()} apps")
            promise.resolve(usageStatsArray)
            
        } catch (e: Exception) {
            android.util.Log.e("UsageStatsModule", "Error getting accurate usage stats, falling back to regular stats", e)
            // Fallback to regular usage stats if events fail
            getUsageStats(startTime, endTime, promise)
        }
    }

    @ReactMethod
    fun getTodayUsageStats(promise: Promise) {
        try {
            // Ensure we start from exactly 12:00 AM (00:00:00.000) today
            val calendar = Calendar.getInstance()
            calendar.set(Calendar.HOUR_OF_DAY, 0)  // 12:00 AM (midnight)
            calendar.set(Calendar.MINUTE, 0)
            calendar.set(Calendar.SECOND, 0)
            calendar.set(Calendar.MILLISECOND, 0)
            val startTime = calendar.timeInMillis.toDouble()
            val endTime = System.currentTimeMillis().toDouble()
            
            android.util.Log.d("UsageStatsModule", "Today's stats: ${calendar.time} to ${Date(endTime.toLong())}")
            
            // Try accurate method first, fallback to regular if needed
            getAccurateUsageStats(startTime, endTime, promise)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get today's usage stats: ${e.message}")
        }
    }
}
