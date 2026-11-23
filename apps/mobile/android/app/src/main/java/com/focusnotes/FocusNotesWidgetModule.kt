package com.focusnotes

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.CalendarContract
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.uimanager.ViewManager
import org.json.JSONObject

class FocusNotesWidgetModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    companion object {
        private const val REQUEST_EXPORT = 7301
        private const val REQUEST_IMPORT = 7302
        private const val REQUEST_SYNC = 7303
    }

    private var pendingPromise: Promise? = null
    private var pendingExportJson: String? = null

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode != REQUEST_EXPORT && requestCode != REQUEST_IMPORT && requestCode != REQUEST_SYNC) return
            val promise = pendingPromise ?: return
            pendingPromise = null
            val uri = data?.data
            if (resultCode != Activity.RESULT_OK || uri == null) {
                if (requestCode == REQUEST_EXPORT) promise.resolve(false) else promise.resolve(null)
                pendingExportJson = null
                return
            }
            try {
                if (requestCode == REQUEST_EXPORT) {
                    val json = pendingExportJson ?: throw IllegalStateException("导出内容丢失。")
                    reactApplicationContext.contentResolver.openOutputStream(uri, "wt")?.use { stream ->
                        stream.write(json.toByteArray(Charsets.UTF_8))
                    } ?: throw IllegalStateException("无法写入所选文件。")
                    pendingExportJson = null
                    promise.resolve(true)
                } else {
                    val contents = reactApplicationContext.contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }
                        ?: throw IllegalStateException("无法读取所选文件。")
                    if (requestCode == REQUEST_IMPORT) {
                        promise.resolve(Arguments.createMap().apply { putString("contents", contents) })
                    } else {
                        promise.resolve(Arguments.createMap().apply {
                            putString("contents", contents)
                            putString("uri", uri.toString())
                        })
                    }
                }
            } catch (error: Exception) {
                pendingExportJson = null
                promise.reject("E_FILE_ACCESS", error)
            }
        }
    }

    init {
        context.addActivityEventListener(activityEventListener)
    }

    override fun getName(): String = "FocusNotesWidget"

    @ReactMethod
    fun updateTodos(json: String) {
        FocusNotesWidgetProvider.updateTodos(reactApplicationContext, json)
    }

    @ReactMethod
    fun updateHabits(json: String) {
        FocusNotesWidgetProvider.updateHabits(reactApplicationContext, json)
    }

    @ReactMethod
    fun updatePrefs(json: String) {
        FocusNotesWidgetProvider.updatePrefs(reactApplicationContext, json)
    }

    @ReactMethod
    fun syncTimer(json: String) {
        val running = try { JSONObject(json).optBoolean("running", false) } catch (_: Exception) { false }
        if (running) FocusTimerService.sync(reactApplicationContext, json)
        else FocusTimerService.stop(reactApplicationContext)
    }

    @ReactMethod
    fun startNoise(scene: String, volume: Int) {
        WhiteNoiseService.start(reactApplicationContext, scene, volume)
    }

    @ReactMethod
    fun setNoiseVolume(volume: Int) {
        WhiteNoiseService.setVolume(reactApplicationContext, volume)
    }

    @ReactMethod
    fun setNoiseSleepTimer(minutes: Int) {
        WhiteNoiseService.setSleepTimer(reactApplicationContext, minutes)
    }

    @ReactMethod
    fun stopNoise() {
        WhiteNoiseService.stop(reactApplicationContext)
    }

    @ReactMethod
    fun setNoiseScenes(scenes: String) {
        WhiteNoiseService.setScenes(reactApplicationContext, scenes)
    }

    @ReactMethod
    fun syncReminders(json: String) {
        TodoReminderScheduler.sync(reactApplicationContext, json)
    }

    @ReactMethod
    fun addToCalendar(title: String, notes: String, dueAt: String, promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "无法打开系统日历，请重试。")
            return
        }
        try {
            val beginTime = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                .apply { timeZone = TimeZone.getTimeZone("UTC") }
                .parse(dueAt)?.time ?: throw IllegalArgumentException("截止时间无效。")
            val intent = Intent(Intent.ACTION_INSERT).apply {
                data = CalendarContract.Events.CONTENT_URI
                putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, beginTime)
                putExtra(CalendarContract.EXTRA_EVENT_END_TIME, beginTime + 60 * 60 * 1000L)
                putExtra(CalendarContract.Events.TITLE, title)
                putExtra(CalendarContract.Events.DESCRIPTION, notes)
            }
            activity.startActivity(Intent.createChooser(intent, "添加到系统日历"))
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("E_CALENDAR_OPEN", "无法打开系统日历。", error)
        }
    }

    @ReactMethod
    fun exportData(json: String, promise: Promise) {
        if (pendingPromise != null) {
            promise.reject("E_PICKER_BUSY", "已有文件选择操作正在进行。")
            return
        }
        pendingExportJson = json
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/json"
            putExtra(Intent.EXTRA_TITLE, "FocusNotes-backup.json")
        }
        launchPicker(intent, REQUEST_EXPORT, promise)
    }

    @ReactMethod
    fun importData(promise: Promise) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "text/json", "text/plain"))
        }
        launchPicker(intent, REQUEST_IMPORT, promise)
    }

    @ReactMethod
    fun openSyncFile(promise: Promise) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/json"
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        launchPicker(intent, REQUEST_SYNC, promise)
    }

    @ReactMethod
    fun saveSyncFile(uriString: String, json: String, promise: Promise) {
        try {
            val uri = Uri.parse(uriString)
            reactApplicationContext.contentResolver.openOutputStream(uri, "wt")?.use { stream ->
                stream.write(json.toByteArray(Charsets.UTF_8))
            } ?: throw IllegalStateException("无法写入同步文件。")
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("E_SYNC_WRITE", error)
        }
    }

    private fun launchPicker(intent: Intent, requestCode: Int, promise: Promise) {
        if (pendingPromise != null) {
            promise.reject("E_PICKER_BUSY", "已有文件选择操作正在进行。")
            return
        }
        val activity = currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "无法打开文件选择器，请重试。")
            return
        }
        pendingPromise = promise
        try {
            activity.startActivityForResult(intent, requestCode)
        } catch (error: Exception) {
            pendingPromise = null
            pendingExportJson = null
            promise.reject("E_PICKER_OPEN", error)
        }
    }
}

class FocusNotesWidgetPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(FocusNotesWidgetModule(context), CalendarModule(context))
    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
