package com.yourname.lucid

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.widget.RemoteViews

// Intent actions
const val ACTION_ARM     = "com.yourname.lucid.WBTB_ARM"
const val ACTION_CANCEL  = "com.yourname.lucid.WBTB_CANCEL"
const val ACTION_DISMISS = "com.yourname.lucid.WBTB_DISMISS"
const val ACTION_TICK    = "com.yourname.lucid.WBTB_TICK"
const val ACTION_FIRE    = "com.yourname.lucid.WBTB_FIRE"

// SharedPrefs keys
const val PREFS_NAME           = "WBTBWidgetPrefs"
const val KEY_STATE            = "state"
const val KEY_FIRE_AT_MS       = "fireAtMs"
const val KEY_ARMED_AT_MS      = "armedAtMs"
const val KEY_SLEEP_HOURS      = "sleepHours"
const val KEY_BUFFER_MINUTES   = "bufferMinutes"
const val KEY_ALARM_SOUND      = "alarmSound"
const val KEY_ALARM_SOUND_FILE = "alarmSoundFile"
const val KEY_ALARM_DURATION   = "alarmDuration"
const val KEY_HISTORY          = "wbtbHistory"

class WBTBWidget : AppWidgetProvider() {

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        when (intent.action) {
            ACTION_ARM     -> handleArm(context, prefs)
            ACTION_CANCEL  -> handleCancel(context, prefs)
            ACTION_DISMISS -> handleDismiss(context, prefs)
            ACTION_FIRE    -> handleFire(context, prefs)
            ACTION_TICK    -> {
                updateAllWidgets(context)
                val state = prefs.getString(KEY_STATE, "idle")
                if (state == "armed" || state == "ringing") {
                    scheduleNextTick(context, System.currentTimeMillis() + 60_000)
                }
            }
        }
    }

    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        for (id in ids) updateWidget(context, mgr, id)
    }

    override fun onDisabled(context: Context) {
        stopTickAlarm(context)
    }
}

private fun handleArm(context: Context, prefs: SharedPreferences) {
    val sleepHours    = prefs.getFloat(KEY_SLEEP_HOURS, 5f)
    val bufferMinutes = prefs.getInt(KEY_BUFFER_MINUTES, 20)
    val armedAtMs     = System.currentTimeMillis()
    val fireAtMs      = armedAtMs +
            (sleepHours * 60 * 60 * 1000).toLong() +
            (bufferMinutes * 60 * 1000).toLong()

    prefs.edit()
        .putString(KEY_STATE, "armed")
        .putLong(KEY_FIRE_AT_MS, fireAtMs)
        .putLong(KEY_ARMED_AT_MS, armedAtMs)
        .apply()

    scheduleFireAlarm(context, fireAtMs)
    scheduleNextTick(context, System.currentTimeMillis() + 60_000)
    updateAllWidgets(context)
}

private fun handleCancel(context: Context, prefs: SharedPreferences) {
    val state = prefs.getString(KEY_STATE, "idle")
    if (state == "ringing") {
        context.stopService(Intent(context, WBTBAlarmService::class.java))
    }
    cancelFireAlarm(context)
    stopTickAlarm(context)

    prefs.edit()
        .putString(KEY_STATE, "idle")
        .remove(KEY_FIRE_AT_MS)
        .remove(KEY_ARMED_AT_MS)
        .apply()

    updateAllWidgets(context)
}

private fun handleFire(context: Context, prefs: SharedPreferences) {
    prefs.edit().putString(KEY_STATE, "ringing").apply()

    val armedAtMs = prefs.getLong(KEY_ARMED_AT_MS, 0L)
    val fireAtMs  = prefs.getLong(KEY_FIRE_AT_MS, 0L)
    if (armedAtMs > 0L && fireAtMs > 0L) writeHistory(prefs, armedAtMs, fireAtMs)

    val alarmDuration = prefs.getInt(KEY_ALARM_DURATION, 30)

    val serviceIntent = Intent(context, WBTBAlarmService::class.java).apply {
        putExtra("alarmSound",     prefs.getString(KEY_ALARM_SOUND, "default"))
        putExtra("alarmSoundFile", prefs.getString(KEY_ALARM_SOUND_FILE, ""))
        putExtra("alarmSoundLoop", prefs.getBoolean("alarmSoundLoop", true))
        putExtra("alarmDuration",  alarmDuration)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(serviceIntent)
    } else {
        context.startService(serviceIntent)
    }

    updateAllWidgets(context)

    // Auto-dismiss after the actual configured duration + 1s buffer
    Handler(Looper.getMainLooper()).postDelayed({
        val s = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_STATE, "idle")
        if (s == "ringing") {
            handleDismiss(context, context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE))
        }
    }, (alarmDuration * 1000L) + 1000L)
}

private fun handleDismiss(context: Context, prefs: SharedPreferences) {
    context.stopService(Intent(context, WBTBAlarmService::class.java))
    stopTickAlarm(context)

    prefs.edit()
        .putString(KEY_STATE, "idle")
        .remove(KEY_FIRE_AT_MS)
        .remove(KEY_ARMED_AT_MS)
        .apply()

    updateAllWidgets(context)
}

private fun writeHistory(prefs: SharedPreferences, armedAtMs: Long, fireAtMs: Long) {
    val existing = prefs.getString(KEY_HISTORY, "[]") ?: "[]"
    val base     = if (existing.trim() == "[]") "[" else existing.trimEnd().dropLast(1) + ","
    val record   = """{"armedAt":"${isoMs(armedAtMs)}","alarmAt":"${isoMs(fireAtMs)}","firedAt":"${isoMs(System.currentTimeMillis())}"}"""
    prefs.edit().putString(KEY_HISTORY, "$base$record]").apply()
}

private fun isoMs(ms: Long): String {
    val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US)
    sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
    return sdf.format(java.util.Date(ms))
}

fun updateAllWidgets(context: Context) {
    val mgr = AppWidgetManager.getInstance(context)
    val ids = mgr.getAppWidgetIds(
        android.content.ComponentName(context, WBTBWidget::class.java)
    )
    for (id in ids) updateWidget(context, mgr, id)
}

fun updateWidget(context: Context, mgr: AppWidgetManager, widgetId: Int) {
    val prefs  = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val state  = prefs.getString(KEY_STATE, "idle") ?: "idle"
    val fireAt = prefs.getLong(KEY_FIRE_AT_MS, 0L)
    val now    = System.currentTimeMillis()

    val views = RemoteViews(context.packageName, R.layout.wbtb_widget)

    views.setOnClickPendingIntent(R.id.btn_arm,     makePi(context, ACTION_ARM,     widgetId))
    views.setOnClickPendingIntent(R.id.btn_cancel,  makePi(context, ACTION_CANCEL,  widgetId))
    views.setOnClickPendingIntent(R.id.btn_dismiss, makePi(context, ACTION_DISMISS, widgetId))

    when (state) {
        "idle" -> {
            val sleepH   = prefs.getFloat(KEY_SLEEP_HOURS, 5f)
            val bufMin   = prefs.getInt(KEY_BUFFER_MINUTES, 20)
            val totalMin = (sleepH * 60).toInt() + bufMin
            val h = totalMin / 60
            val m = totalMin % 60
            views.setTextViewText(R.id.timer_text,  if (m == 0) "${h}h" else "${h}h ${m}m")
            views.setTextViewText(R.id.status_text, "Tap ARM to start")
            views.setViewVisibility(R.id.btn_arm,     android.view.View.VISIBLE)
            views.setViewVisibility(R.id.btn_cancel,  android.view.View.GONE)
            views.setViewVisibility(R.id.btn_dismiss, android.view.View.GONE)
        }
        "armed" -> {
            val remainMs  = (fireAt - now).coerceAtLeast(0)
            val totalMins = ((remainMs + 59_999) / 60_000).toInt()
            val h = totalMins / 60
            val m = totalMins % 60
            views.setTextViewText(R.id.timer_text,
                if (h > 0 && m > 0) "${h}h ${m}m"
                else if (h > 0)     "${h}h"
                else                "${m}m"
            )
            val atTime = java.text.SimpleDateFormat("h:mm a", java.util.Locale.getDefault())
                .format(java.util.Date(fireAt))
            views.setTextViewText(R.id.status_text, "Alarm at $atTime")
            views.setViewVisibility(R.id.btn_arm,     android.view.View.GONE)
            views.setViewVisibility(R.id.btn_cancel,  android.view.View.VISIBLE)
            views.setViewVisibility(R.id.btn_dismiss, android.view.View.GONE)
        }
        "ringing" -> {
            views.setTextViewText(R.id.timer_text,  "Wake up!")
            views.setTextViewText(R.id.status_text, "WBTB alarm ringing")
            views.setViewVisibility(R.id.btn_arm,     android.view.View.GONE)
            views.setViewVisibility(R.id.btn_cancel,  android.view.View.GONE)
            views.setViewVisibility(R.id.btn_dismiss, android.view.View.VISIBLE)
        }
    }

    mgr.updateAppWidget(widgetId, views)
}

private fun scheduleFireAlarm(context: Context, fireAtMs: Long) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAtMs, getFirePi(context))
    } else {
        am.setExact(AlarmManager.RTC_WAKEUP, fireAtMs, getFirePi(context))
    }
}

private fun cancelFireAlarm(context: Context) {
    (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(getFirePi(context))
}

private fun getFirePi(context: Context): PendingIntent {
    val i = Intent(context, WBTBWidget::class.java).apply { action = ACTION_FIRE }
    return PendingIntent.getBroadcast(
        context, 1001, i,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
}

fun scheduleNextTick(context: Context, triggerMs: Long) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, getTickPi(context))
    } else {
        am.setExact(AlarmManager.RTC_WAKEUP, triggerMs, getTickPi(context))
    }
}

fun stopTickAlarm(context: Context) {
    (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(getTickPi(context))
}

private fun getTickPi(context: Context): PendingIntent {
    val i = Intent(context, WBTBWidget::class.java).apply { action = ACTION_TICK }
    return PendingIntent.getBroadcast(
        context, 1002, i,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
}

private fun makePi(context: Context, action: String, widgetId: Int): PendingIntent {
    val i = Intent(context, WBTBWidget::class.java).apply {
        this.action = action
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
    }
    val reqCode = when (action) {
        ACTION_ARM     -> 2001
        ACTION_CANCEL  -> 2002
        ACTION_DISMISS -> 2003
        else           -> 2004
    } + widgetId
    return PendingIntent.getBroadcast(
        context, reqCode, i,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
}