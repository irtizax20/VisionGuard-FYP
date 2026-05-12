package com.wajahat001.blinkfit

import android.util.Log
import com.google.mlkit.vision.face.Face
import kotlin.math.abs

/**
 * Helper class for blink detection and distance calculation
 * Uses ML Kit's eye openness probability for accurate blink detection
 */
class BlinkDetectionHelper {
    
    companion object {
        private const val TAG = "BlinkDetectionHelper"
        
        // Blink detection parameters - using eye openness probability
        private const val EYE_CLOSED_THRESHOLD = 0.3f // Below this = eyes closed (only 20% open)
        private const val CONSEC_FRAMES = 2 // Frames needed to confirm blink (reduce false positives)
        
        // Distance calculation parameters
        // Improved focal length estimation (will be calibrated per device if possible)
        private const val DEFAULT_FOCAL_LENGTH = 700f // More realistic default
        private const val KNOWN_FACE_WIDTH = 14.0f // cm (average adult face width)
        
        // Focal length range for validation
        private const val MIN_FOCAL_LENGTH = 400f
        private const val MAX_FOCAL_LENGTH = 1500f
    }
    
    // Blink tracking state
    private var blinkCounter = 0
    private var frameCounter = 0
    private var blinkInProgress = false
    
    // Distance tracking with focal length calibration
    private val distanceMeasurements = mutableListOf<Float>()
    private var calibratedFocalLength: Float? = null
    
    /**
     * Process face for blink detection using ML Kit's eye openness probability
     * This is more accurate than fake landmarks
     */
    fun processBlink(face: Face): Boolean {
        // Get eye openness probabilities from ML Kit
        val leftEyeOpen = face.leftEyeOpenProbability
        val rightEyeOpen = face.rightEyeOpenProbability
        
        // Check if probabilities are available
        if (leftEyeOpen == null || rightEyeOpen == null) {
            Log.w(TAG, "⚠️ Eye openness not available - ensure CLASSIFICATION_MODE_ALL is enabled")
            return false
        }
        
        // Average both eyes
        val avgEyeOpen = (leftEyeOpen + rightEyeOpen) / 2.0f
        
        Log.v(TAG, "Eye openness: $avgEyeOpen (Threshold: $EYE_CLOSED_THRESHOLD)")
        
        var blinkDetected = false
        
        // Eyes are closed when probability is below threshold
        if (avgEyeOpen < EYE_CLOSED_THRESHOLD) {
            // Eyes closed - start counting frames
            if (!blinkInProgress) {
                frameCounter++
                
                // Confirm blink after consecutive frames
                if (frameCounter >= CONSEC_FRAMES) {
                    blinkCounter++
                    blinkInProgress = true
                    blinkDetected = true
                    frameCounter = 0 // Reset frame counter
                    Log.d(TAG, "✅ Blink #$blinkCounter detected! (Eye openness: $avgEyeOpen)")
                }
            }
        } else {
            // Eyes opened - reset blink state for next blink
            if (blinkInProgress) {
                Log.v(TAG, "Eyes reopened, ready for next blink")
            }
            blinkInProgress = false
            frameCounter = 0
        }
        
        return blinkDetected
    }
    
    /**
     * Calculate distance from camera using face width
     * Uses calibrated focal length if available, otherwise default
     */
    fun calculateDistance(face: Face, imageWidth: Int): Float? {
        val boundingBox = face.boundingBox
        val faceWidthPixels = boundingBox.width().toFloat()
        
        if (faceWidthPixels <= 0 || faceWidthPixels > imageWidth) {
            Log.w(TAG, "Invalid face width: $faceWidthPixels px")
            return null
        }
        
        // Use calibrated focal length if available, otherwise default
        val focalLength = calibratedFocalLength ?: DEFAULT_FOCAL_LENGTH
        
        // Calculate distance using pinhole camera model
        val distance = (KNOWN_FACE_WIDTH * focalLength) / faceWidthPixels
        
        // Validate reasonable distance (20cm to 200cm)
        if (distance < 20f || distance > 200f) {
            Log.w(TAG, "Distance out of range: $distance cm")
            return null
        }
        
        Log.d(TAG, "Distance: ${distance.toInt()} cm (Face: ${faceWidthPixels.toInt()}px, FL: ${focalLength.toInt()})")
        
        return distance
    }
    
    /**
     * Calibrate focal length using known distance
     * Call this when user is at a known distance (e.g., 50cm)
     */
    fun calibrateFocalLength(face: Face, knownDistanceCm: Float) {
        val boundingBox = face.boundingBox
        val faceWidthPixels = boundingBox.width().toFloat()
        
        if (faceWidthPixels > 0) {
            val calculatedFL = (knownDistanceCm * faceWidthPixels) / KNOWN_FACE_WIDTH
            
            // Validate focal length is in reasonable range
            if (calculatedFL in MIN_FOCAL_LENGTH..MAX_FOCAL_LENGTH) {
                calibratedFocalLength = calculatedFL
                Log.i(TAG, "✅ Focal length calibrated: $calculatedFL (was using $DEFAULT_FOCAL_LENGTH)")
            } else {
                Log.w(TAG, "Calibration failed: FL=$calculatedFL out of range")
            }
        }
    }
    
    fun addDistanceMeasurement(distance: Float) {
        distanceMeasurements.add(distance)
        Log.d(TAG, "Distance measurement added: $distance cm (Total: ${distanceMeasurements.size})")
    }
    
    fun getBlinkCount(): Int = blinkCounter
    
    fun getAverageDistance(): Float {
        return if (distanceMeasurements.isEmpty()) {
            0f
        } else {
            distanceMeasurements.average().toFloat()
        }
    }
    
    fun getDistanceMeasurementCount(): Int = distanceMeasurements.size
    
    fun reset() {
        blinkCounter = 0
        frameCounter = 0
        blinkInProgress = false
        distanceMeasurements.clear()
        Log.d(TAG, "Helper reset")
    }
}
