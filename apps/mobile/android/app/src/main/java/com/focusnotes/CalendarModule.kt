package com.focusnotes

import android.content.ContentUris
import android.content.ContentValues
import android.provider.CalendarContract
import androidx.core.content.ContextCompat
import android.Manifest
import android.content.pm.PackageManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.time.Instant
import java.util.TimeZone

/** 系统日历桥接：写入待办提醒、读取日历事件。 */
class CalendarModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "FocusNotesCalendar"

    private fun hasPermission(permission: String): Boolean = ContextCompat.checkSelfPermission(
        reactApplicationContext,
        permission,
    ) == PackageManager.PERMISSION_GRANTED

    private fun writableCalendarId(): Long? {
        val projection = arrayOf(CalendarContract.Calendars._ID, CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL, CalendarContract.Calendars.VISIBLE)
        reactApplicationContext.contentResolver.query(CalendarContract.Calendars.CONTENT_URI, projection, null, null, null)?.use { cursor ->
            while (cursor.moveToNext()) {
                val access = cursor.getInt(1)
                val visible = cursor.getInt(2)
                if (visible == 1 && access >= CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR) {
                    return cursor.getLong(0)
                }
            }
        }
        return null
    }

    @ReactMethod
    fun addEvent(title: String, dueAt: String, notes: String, promise: Promise) {
        if (!hasPermission(Manifest.permission.WRITE_CALENDAR)) {
            promise.reject("calendar_permission_denied", "缺少写入日历权限")
            return
        }
        try {
            val options = writableCalendarId() ?: return promise.reject("calendar_not_writable", "没有可写入的系统日历")
            val start = Instant.parse(dueAt).toEpochMilli()
            val values = ContentValues().apply {
                put(CalendarContract.Events.CALENDAR_ID, options)
                put(CalendarContract.Events.TITLE, title.take(200))
                put(CalendarContract.Events.DESCRIPTION, notes.take(2000))
                put(CalendarContract.Events.DTSTART, start)
                put(CalendarContract.Events.DTEND, start + 60 * 60 * 1000)
                put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
                put(CalendarContract.Events.HAS_ALARM, 1)
            }
            val uri = reactApplicationContext.contentResolver.insert(CalendarContract.Events.CONTENT_URI, values)
            if (uri == null) return promise.reject("calendar_insert_failed", "写入日历失败")
            val eventId = ContentUris.parseId(uri)
            val reminder = ContentValues().apply {
                put(CalendarContract.Reminders.EVENT_ID, eventId)
                put(CalendarContract.Reminders.MINUTES, 10)
                put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT)
            }
            reactApplicationContext.contentResolver.insert(CalendarContract.Reminders.CONTENT_URI, reminder)
            promise.resolve(eventId.toString())
        } catch (error: Exception) {
            promise.reject("calendar_insert_failed", error.message, error)
        }
    }

    @ReactMethod
    fun listEvents(start: Double, end: Double, promise: Promise) {
        if (!hasPermission(Manifest.permission.READ_CALENDAR)) {
            promise.reject("calendar_permission_denied", "缺少读取日历权限")
            return
        }
        try {
            val builder = CalendarContract.Instances.CONTENT_URI.buildUpon()
            ContentUris.appendId(builder, start.toLong())
            ContentUris.appendId(builder, end.toLong())
            val projection = arrayOf(
                CalendarContract.Instances.EVENT_ID,
                CalendarContract.Instances.TITLE,
                CalendarContract.Instances.BEGIN,
                CalendarContract.Instances.END,
                CalendarContract.Instances.ALL_DAY,
            )
            val events = Arguments.createArray()
            reactApplicationContext.contentResolver.query(builder.build(), projection, null, null, "${CalendarContract.Instances.BEGIN} ASC")?.use { cursor ->
                while (cursor.moveToNext()) {
                    val item = Arguments.createMap()
                    item.putString("id", cursor.getLong(0).toString())
                    item.putString("title", cursor.getString(1) ?: "")
                    item.putDouble("start", cursor.getLong(2).toDouble())
                    item.putDouble("end", cursor.getLong(3).toDouble())
                    item.putBoolean("allDay", cursor.getInt(4) == 1)
                    events.pushMap(item)
                }
            }
            promise.resolve(events)
        } catch (error: Exception) {
            promise.reject("calendar_query_failed", error.message, error)
        }
    }
}