package com.yourname.lucid

import android.content.Context
import com.facebook.react.bridge.*

class WBTBSettingsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "WBTBSettings"

    @ReactMethod
    fun save(
        bufferMinutes: Int,
        sleepHours: Double,
        alarmSound: String,
        alarmSoundFile: String,
        alarmSoundLoop: Boolean,
        promise: Promise
    ) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(
                PREFS_NAME, Context.MODE_PRIVATE
            )
            prefs.edit()
                .putInt(KEY_BUFFER_MINUTES, bufferMinutes)
                .putFloat(KEY_SLEEP_HOURS, sleepHours.toFloat())
                .putString(KEY_ALARM_SOUND, alarmSound)
                .putString(KEY_ALARM_SOUND_FILE, alarmSoundFile)
                .putBoolean("alarmSoundLoop", alarmSoundLoop)
                .apply()

            updateAllWidgets(reactApplicationContext)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WBTB_SAVE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun saveDuration(durationSeconds: Int, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(
                PREFS_NAME, Context.MODE_PRIVATE
            )
            prefs.edit()
                .putInt(KEY_ALARM_DURATION, durationSeconds)
                .apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WBTB_SAVE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getHistory(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(
                PREFS_NAME, Context.MODE_PRIVATE
            )
            val history = prefs.getString(KEY_HISTORY, "[]") ?: "[]"
            promise.resolve(history)
        } catch (e: Exception) {
            promise.reject("WBTB_HISTORY_ERROR", e.message)
        }
    }
}