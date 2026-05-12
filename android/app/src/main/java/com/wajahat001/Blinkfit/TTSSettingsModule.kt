package com.wajahat001.blinkfit

import android.content.Context
import android.content.SharedPreferences
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.util.Log
import com.facebook.react.bridge.*
import java.util.*

class TTSSettingsModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "TTSSettingsModule"
        private const val PREFS_NAME = "TTSSettings"
        private const val KEY_LANGUAGE = "tts_language"
        const val LANG_ENGLISH = "english"
        const val LANG_URDU = "urdu"
    }

    private var testTTS: TextToSpeech? = null
    private val prefs: SharedPreferences = 
        reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    override fun getName(): String = "TTSSettings"

    /**
     * Set language preference for TTS
     */
    @ReactMethod
    fun setLanguagePreference(language: String, promise: Promise) {
        try {
            if (language != LANG_ENGLISH && language != LANG_URDU) {
                promise.reject("INVALID_LANGUAGE", "Language must be 'english' or 'urdu'")
                return
            }

            prefs.edit().putString(KEY_LANGUAGE, language).apply()
            Log.d(TAG, "✅ Language preference saved: $language")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error saving language preference", e)
            promise.reject("SAVE_ERROR", e.message, e)
        }
    }

    /**
     * Get current language preference
     */
    @ReactMethod
    fun getLanguagePreference(promise: Promise) {
        try {
            val language = prefs.getString(KEY_LANGUAGE, LANG_ENGLISH) ?: LANG_ENGLISH
            Log.d(TAG, "📖 Current language: $language")
            promise.resolve(language)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error reading language preference", e)
            promise.reject("READ_ERROR", e.message, e)
        }
    }

    /**
     * Get available languages
     */
    @ReactMethod
    fun getAvailableLanguages(promise: Promise) {
        try {
            val languages = Arguments.createArray().apply {
                pushString(LANG_ENGLISH)
                pushString(LANG_URDU)
            }
            promise.resolve(languages)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    /**
     * Test voice with sample message
     */
    @ReactMethod
    fun testVoice(language: String, promise: Promise) {
        try {
            Log.d(TAG, "🔊 Testing voice for language: $language")

            // Clean up previous test TTS if exists
            testTTS?.stop()
            testTTS?.shutdown()

            testTTS = TextToSpeech(reactApplicationContext) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    val locale = when (language) {
                        LANG_URDU -> Locale("ur", "PK")
                        else -> Locale.US
                    }

                    val result = testTTS?.setLanguage(locale)
                    
                    if (result == TextToSpeech.LANG_MISSING_DATA || 
                        result == TextToSpeech.LANG_NOT_SUPPORTED) {
                        Log.w(TAG, "⚠️ Language not supported: $language")
                        promise.reject(
                            "LANG_NOT_SUPPORTED",
                            "Language not supported. Please install $language language data for Text-to-Speech."
                        )
                        testTTS?.shutdown()
                        testTTS = null
                    } else {
                        // Test message based on language
                        val testMessage = when (language) {
                            LANG_URDU -> "وقفہ لیں! اپنی آنکھوں کو آرام دیں۔ شکریہ۔"
                            else -> "Time for a break! Rest your eyes. Thank you."
                        }

                        val params = Bundle().apply {
                            putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, 3) // STREAM_MUSIC
                        }

                        val speakResult = testTTS?.speak(
                            testMessage,
                            TextToSpeech.QUEUE_FLUSH,
                            params,
                            "test_utterance"
                        )

                        if (speakResult == TextToSpeech.SUCCESS) {
                            Log.d(TAG, "✅ Test voice playing: $testMessage")
                            promise.resolve(true)
                        } else {
                            Log.e(TAG, "❌ Failed to speak test message")
                            promise.reject("SPEAK_ERROR", "Failed to play test voice")
                        }

                        // Cleanup after 5 seconds
                        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                            testTTS?.shutdown()
                            testTTS = null
                        }, 5000)
                    }
                } else {
                    Log.e(TAG, "❌ TTS initialization failed")
                    promise.reject("TTS_INIT_FAILED", "Text-to-Speech initialization failed")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error testing voice", e)
            promise.reject("TEST_ERROR", e.message, e)
        }
    }

    /**
     * Check if a language is available
     */
    @ReactMethod
    fun isLanguageAvailable(language: String, promise: Promise) {
        try {
            val locale = when (language) {
                LANG_URDU -> Locale("ur", "PK")
                else -> Locale.US
            }

            var checkTTS: TextToSpeech? = null
            checkTTS = TextToSpeech(reactApplicationContext) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    val result = checkTTS?.isLanguageAvailable(locale)
                    val available = result != null && result >= TextToSpeech.LANG_AVAILABLE
                    promise.resolve(available)
                    checkTTS?.shutdown()
                } else {
                    promise.reject("TTS_ERROR", "Could not check language availability")
                }
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message, e)
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        testTTS?.shutdown()
        testTTS = null
    }
}
