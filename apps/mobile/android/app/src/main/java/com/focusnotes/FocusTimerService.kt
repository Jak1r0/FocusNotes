package com.focusnotes

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.CountDownTimer
import android.os.IBinder
import androidx.core.app.NotificationCompat
import org.json.JSONObject

class FocusTimerService : Service() {
    companion object {
        private const val CHANNEL_ID = "focusnotes.timer"
        private const val NOTIFICATION_ID = 7304
        private const val EXTRA_STATE = "state"

        fun sync(context: Context, json: String) {
            val intent = Intent(context, FocusTimerService::class.java).putExtra(EXTRA_STATE, json)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
            else context.startService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, FocusTimerService::class.java))
        }
    }

    private var countdown: CountDownTimer? = null

    override fun onCreate() {
        super.onCreate()
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "番茄时钟", NotificationManager.IMPORTANCE_LOW).apply {
                description = "显示正在进行的专注或休息计时"
                setShowBadge(false)
            },
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val state = try { JSONObject(intent?.getStringExtra(EXTRA_STATE) ?: "{}") } catch (_: Exception) { JSONObject() }
        val running = state.optBoolean("running", false)
        if (!running) {
            countdown?.cancel()
            countdown = null
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        val mode = state.optString("mode", "countdown")
        val phase = state.optString("phase", "focus")
        val seconds = if (mode == "stopwatch") state.optInt("elapsed", 0).coerceAtLeast(0)
        else state.optInt("remaining", 0).coerceAtLeast(0)
        val notification = createNotification(mode, phase, seconds)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        countdown?.cancel()
        countdown = if (mode == "countdown") {
            object : CountDownTimer(seconds * 1000L, 1000) {
                override fun onTick(millisUntilFinished: Long) = Unit
                override fun onFinish() {
                    countdown = null
                    getSystemService(NotificationManager::class.java).notify(
                        NOTIFICATION_ID,
                        createCompletedNotification(phase),
                    )
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                }
            }.start()
        } else null
        return START_NOT_STICKY
    }

    private fun createNotification(mode: String, phase: String, seconds: Int): Notification {
        val intent = PendingIntent.getActivity(
            this,
            NOTIFICATION_ID,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val title = if (phase == "break") "休息中" else "专注中"
        val text = if (mode == "stopwatch") "正计时 · 触碰打开 FocusNotes" else "番茄计时 · 触碰打开 FocusNotes"
        val whenMillis = if (mode == "stopwatch") System.currentTimeMillis() - seconds * 1000L
        else System.currentTimeMillis() + seconds * 1000L
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(intent)
            .setWhen(whenMillis)
            .setUsesChronometer(true)
            .setChronometerCountDown(mode == "countdown")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createCompletedNotification(phase: String): Notification {
        val intent = PendingIntent.getActivity(
            this,
            NOTIFICATION_ID,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val title = if (phase == "focus") "番茄完成" else "休息结束"
        val text = if (phase == "focus") "专注时间结束，起来活动一下。" else "准备好开始下一个专注了吗？"
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(intent)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
    }

    override fun onDestroy() {
        countdown?.cancel()
        countdown = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
