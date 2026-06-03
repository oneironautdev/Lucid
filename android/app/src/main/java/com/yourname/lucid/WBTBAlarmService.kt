package com.yourname.lucid

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.*
import androidx.core.app.NotificationCompat

class WBTBAlarmService : Service() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private val handler = Handler(Looper.getMainLooper())
    private var durationMs: Long = 30_000L
    private var elapsed: Long = 0L
    private val TICK_MS = 500L  // tick every 500ms for smoother escalation

    // 12 vibration steps — index is chosen by progress through duration
    // Goes from short sparse pulses → long heavy continuous
    private val VIBRATION_STEPS = arrayOf(
        longArrayOf(0, 150, 850),   // step 0 — very light
        longArrayOf(0, 200, 800),
        longArrayOf(0, 280, 720),
        longArrayOf(0, 370, 630),
        longArrayOf(0, 460, 540),
        longArrayOf(0, 550, 450),
        longArrayOf(0, 640, 360),
        longArrayOf(0, 730, 270),
        longArrayOf(0, 820, 180),
        longArrayOf(0, 900, 100),
        longArrayOf(0, 1000, 80),
        longArrayOf(0, 1500, 50),   // step 11 — near continuous heavy
    )

    private val tickRunnable = object : Runnable {
        override fun run() {
            elapsed += TICK_MS
            updateVibration()
            escalateVolume()
            if (elapsed < durationMs) {
                handler.postDelayed(this, TICK_MS)
            } else {
                stopSelf()
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vm.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val alarmSound     = intent?.getStringExtra("alarmSound") ?: "default"
        val alarmSoundFile = intent?.getStringExtra("alarmSoundFile") ?: ""
        val alarmDurationSec = intent?.getIntExtra("alarmDuration", 30) ?: 30
        durationMs = alarmDurationSec * 1000L

        startForeground(NOTIF_ID, buildNotification())
        startAudio(alarmSound, alarmSoundFile)
        handler.post(tickRunnable)

        return START_NOT_STICKY
    }

    private fun startAudio(alarmSound: String, alarmSoundFile: String) {
        try {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)
            // Start at 30% and escalate to 100%
            audioManager.setStreamVolume(
                AudioManager.STREAM_ALARM,
                (maxVol * 0.3f).toInt().coerceAtLeast(1),
                0
            )

            val soundUri: Uri = when {
                alarmSound == "custom" && alarmSoundFile.isNotEmpty() ->
                    Uri.parse(alarmSoundFile)
                else ->
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            }

            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(this@WBTBAlarmService, soundUri)
                isLooping = true
                prepare()
                start()
            }
        } catch (e: Exception) {
            try {
                val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                val ringtone = RingtoneManager.getRingtone(this, uri)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    ringtone.isLooping = true
                }
                ringtone.play()
            } catch (_: Exception) {}
        }
    }

    private fun escalateVolume() {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)
        val progress = (elapsed.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)
        // Ramp from 30% to 100% over the full duration
        val targetVol = ((0.3f + 0.7f * progress) * maxVol).toInt().coerceIn(1, maxVol)
        audioManager.setStreamVolume(AudioManager.STREAM_ALARM, targetVol, 0)
    }

    private fun updateVibration() {
        val progress = (elapsed.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)
        // Map progress 0.0–1.0 across all 12 steps
        val stepIndex = (progress * (VIBRATION_STEPS.size - 1)).toInt()
            .coerceIn(0, VIBRATION_STEPS.size - 1)
        val pattern = VIBRATION_STEPS[stepIndex]
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createWaveform(pattern, -1))
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(pattern, -1)
        }
    }

    override fun onDestroy() {
        handler.removeCallbacks(tickRunnable)
        mediaPlayer?.stop()
        mediaPlayer?.release()
        mediaPlayer = null
        vibrator?.cancel()
        updateAllWidgets(this)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?) = null

    private fun buildNotification(): Notification {
        val channelId = "wbtb_alarm"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId, "WBTB Alarm",
                NotificationManager.IMPORTANCE_HIGH
            ).apply { setSound(null, null) }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }

        val dismissIntent = Intent(this, WBTBWidget::class.java).apply {
            action = ACTION_DISMISS
        }
        val dismissPi = PendingIntent.getBroadcast(
            this, 3001, dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, channelId)
            .setContentTitle("WBTB Alarm")
            .setContentText("Time to wake up for your lucid dreaming session")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .addAction(0, "Dismiss", dismissPi)
            .setOngoing(true)
            .build()
    }

    companion object {
        const val NOTIF_ID = 9001
    }
}