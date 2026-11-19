package com.focusnotes

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

object TodoReminderScheduler {
    private const val PREFS = "focusnotes.reminders"
    private const val KEY_REMINDERS = "reminders"

    private data class Reminder(val id: String, val title: String, val dueAt: String, val leadMinutes: Int)

    fun sync(context: Context, json: String, force: Boolean = false) {
        val preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val previous = parseReminders(preferences.getString(KEY_REMINDERS, "[]") ?: "[]").associateBy { it.id }
        val current = parseReminders(json).associateBy { it.id }
        preferences.edit().putString(KEY_REMINDERS, json).apply()
        val manager = context.getSystemService(AlarmManager::class.java)
        for (id in previous.keys + current.keys) {
            val reminder = current[id]
            val unchanged = !force && previous[id] == reminder && (reminder == null || parseUtc(reminder.dueAt) > System.currentTimeMillis())
            if (unchanged) continue
            cancel(context, manager, id)
            if (reminder == null) continue
            val dueAt = parseUtc(reminder.dueAt)
            if (dueAt <= System.currentTimeMillis() || reminder.leadMinutes <= 0) continue
            val pending = PendingIntent.getBroadcast(
                context,
                0,
                reminderIntent(context, id).putExtra("title", reminder.title),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val triggerAt = maxOf(System.currentTimeMillis() + 5000L, dueAt - reminder.leadMinutes * 60_000L)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
            else manager.set(AlarmManager.RTC_WAKEUP, triggerAt, pending)
        }
    }

    fun restore(context: Context) {
        val json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_REMINDERS, "[]") ?: "[]"
        sync(context, json, force = true)
    }

    private fun cancel(context: Context, manager: AlarmManager, id: String) {
        val pending = PendingIntent.getBroadcast(
            context,
            0,
            reminderIntent(context, id),
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
        )
        if (pending != null) {
            manager.cancel(pending)
            pending.cancel()
        }
        context.getSystemService(NotificationManager::class.java).cancel(id.hashCode())
    }

    private fun parseReminders(json: String): List<Reminder> {
        val values = JSONArray(json)
        return (0 until values.length()).mapNotNull { index ->
            val value = values.optJSONObject(index) ?: return@mapNotNull null
            val id = value.optString("id")
            if (id.isBlank()) return@mapNotNull null
            Reminder(
                id = id,
                title = value.optString("title", "待办"),
                dueAt = value.optString("dueAt"),
                leadMinutes = value.optInt("reminderMinutesBefore", 0),
            )
        }
    }

    private fun reminderIntent(context: Context, id: String): Intent =
        Intent(context, TodoReminderReceiver::class.java)
            .setAction("com.focusnotes.todo.REMINDER")
            .setData(android.net.Uri.parse("focusnotes://todo-reminder/$id"))

    private fun parseUtc(value: String): Long {
        return try {
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                .apply { timeZone = TimeZone.getTimeZone("UTC") }
                .parse(value)?.time ?: 0L
        } catch (_: Exception) {
            0L
        }
    }
}

class TodoReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val manager = context.getSystemService(NotificationManager::class.java)
        val channelId = "focusnotes.todo.reminders"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(channelId, "待办提醒", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "在待办截止前提醒你"
                },
            )
        }
        val openApp = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val title = intent.getStringExtra("title").orEmpty().ifBlank { "待办提醒" }
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText("这项待办即将到期")
            .setContentIntent(openApp)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
        manager.notify(intent.data?.lastPathSegment?.hashCode() ?: title.hashCode(), notification)
    }
}

class ReminderBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) TodoReminderScheduler.restore(context)
    }
}
