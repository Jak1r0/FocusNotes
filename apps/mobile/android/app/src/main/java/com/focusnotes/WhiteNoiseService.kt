package com.focusnotes

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import kotlin.math.PI
import kotlin.math.sin
import kotlin.random.Random

class WhiteNoiseService : Service() {
    companion object {
        private const val CHANNEL_ID = "focusnotes.ambience"
        private const val NOTIFICATION_ID = 7305
        private const val EXTRA_SCENES = "scenes"
        private const val EXTRA_VOLUME = "volume"
        private const val ACTION_START = "com.focusnotes.noise.START"
        private const val ACTION_SCENES = "com.focusnotes.noise.SCENES"
        private const val ACTION_VOLUME = "com.focusnotes.noise.VOLUME"
        private const val ACTION_SLEEP = "com.focusnotes.noise.SLEEP"
        private const val ACTION_STOP = "com.focusnotes.noise.STOP"

        fun start(context: Context, scenes: String, volume: Int) {
            val intent = Intent(context, WhiteNoiseService::class.java)
                .setAction(ACTION_START)
                .putExtra(EXTRA_SCENES, scenes)
                .putExtra(EXTRA_VOLUME, volume.coerceIn(0, 100))
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
            else context.startService(intent)
        }

        fun setScenes(context: Context, scenes: String) {
            context.startService(
                Intent(context, WhiteNoiseService::class.java)
                    .setAction(ACTION_SCENES)
                    .putExtra(EXTRA_SCENES, scenes),
            )
        }

        fun setVolume(context: Context, volume: Int) {
            context.startService(
                Intent(context, WhiteNoiseService::class.java)
                    .setAction(ACTION_VOLUME)
                    .putExtra(EXTRA_VOLUME, volume.coerceIn(0, 100)),
            )
        }

        fun setSleepTimer(context: Context, minutes: Int) {
            context.startService(
                Intent(context, WhiteNoiseService::class.java)
                    .setAction(ACTION_SLEEP)
                    .putExtra("minutes", minutes.coerceIn(0, 1440)),
            )
        }

        fun stop(context: Context) {
            context.startService(Intent(context, WhiteNoiseService::class.java).setAction(ACTION_STOP))
        }
    }

    @Volatile private var playing = false
    @Volatile private var volume = 0.45f
    @Volatile private var playbackGeneration = 0
    @Volatile private var sleepStopAt = 0L
    @Volatile private var scenes = listOf("rain")
    private var audioTrack: AudioTrack? = null
    private var audioThread: Thread? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var sleepStopRunnable: Runnable? = null

    override fun onCreate() {
        super.onCreate()
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "白噪音", NotificationManager.IMPORTANCE_LOW).apply {
                description = "白噪音播放状态"
                setShowBadge(false)
            },
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                clearSleepTimer()
                stopPlayback()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_VOLUME -> {
                volume = (intent.getIntExtra(EXTRA_VOLUME, 45).coerceIn(0, 100) / 100f)
                return START_NOT_STICKY
            }
            ACTION_SLEEP -> {
                scheduleSleepStop(intent.getIntExtra("minutes", 0))
                if (playing) startForegroundForPlayback()
                return START_NOT_STICKY
            }
            ACTION_SCENES -> {
                scenes = parseScenes(intent.getStringExtra(EXTRA_SCENES))
                if (scenes.isEmpty()) {
                    clearSleepTimer()
                    stopPlayback()
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                } else if (playing) {
                    startForegroundForPlayback()
                }
                return START_NOT_STICKY
            }
            else -> {
                clearSleepTimer()
                scenes = parseScenes(intent?.getStringExtra(EXTRA_SCENES))
                volume = (intent?.getIntExtra(EXTRA_VOLUME, 45)?.coerceIn(0, 100) ?: 45) / 100f
                startForegroundForPlayback()
                startPlayback()
            }
        }
        return START_NOT_STICKY
    }

    private fun startForegroundForPlayback() {
        val intent = PendingIntent.getActivity(
            this,
            NOTIFICATION_ID,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val labels = mapOf(
            "rain" to "细雨", "window-rain" to "窗边雨", "storm" to "远雷雨",
            "waves" to "海浪", "river" to "溪流", "fire" to "篝火", "wind" to "风声",
            "forest" to "树林", "birds" to "鸟鸣", "night" to "夏夜", "cafe" to "咖啡馆",
            "white" to "白噪音", "pink" to "粉噪音", "brown" to "棕噪音",
        )
        val label = scenes.mapNotNull { labels[it] }.joinToString(" + ").ifBlank { "环境音" }
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_low_battery)
            .setContentTitle("$label · 正在播放")
            .setContentText(if (sleepStopAt > 0L) "${kotlin.math.ceil((sleepStopAt - System.currentTimeMillis()).coerceAtLeast(0L) / 60_000.0).toInt()} 分钟后渐弱停止" else "触碰打开 FocusNotes")
            .setContentIntent(intent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun startPlayback() {
        stopPlayback()
        val manager = getSystemService(AudioManager::class.java)
        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attributes)
                .setOnAudioFocusChangeListener { change ->
                    if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                        stopPlayback()
                        stopForeground(STOP_FOREGROUND_REMOVE)
                        stopSelf()
                    }
                }
                .build()
            audioFocusRequest = request
            if (manager.requestAudioFocus(request) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return
            }
        } else {
            @Suppress("DEPRECATION")
            if (manager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return
            }
        }

        val sampleRate = 22050
        val bufferBytes = maxOf(
            AudioTrack.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT),
            4096,
        )
        val track = AudioTrack.Builder()
            .setAudioAttributes(attributes)
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(sampleRate)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build(),
            )
            .setTransferMode(AudioTrack.MODE_STREAM)
            .setBufferSizeInBytes(bufferBytes)
            .build()
        audioTrack = track
        track.play()
        playing = true
        val generation = playbackGeneration
        audioThread = Thread({ synthesize(track, sampleRate, generation) }, "FocusNotesAmbientAudio").apply {
            isDaemon = true
            start()
        }
    }

    private fun synthesize(track: AudioTrack, sampleRate: Int, generation: Int) {
        val random = Random(System.nanoTime())
        val samples = ShortArray(1024)
        var index = 0L
        var brown = 0.0
        var p0 = 0.0
        var p1 = 0.0
        var p2 = 0.0
        var p3 = 0.0
        var p4 = 0.0
        var p5 = 0.0
        var p6 = 0.0
        var low = 0.0
        var gust = 0.0
        var nextGust = sampleRate * (5 + random.nextInt(5)).toLong()
        var transientLevel = 0.0
        var transientPhase = 0.0
        var transientFrequency = 1800.0
        var chirpLevel = 0.0
        var chirpPhase = 0.0
        var chirpFrequency = 2400.0

        while (playing && generation == playbackGeneration && !Thread.currentThread().isInterrupted) {
            val stopAt = sleepStopAt
            val fade = if (stopAt > 0L) {
                val remaining = ((stopAt - System.currentTimeMillis()).toDouble() / 30_000.0).coerceIn(0.0, 1.0)
                sin(remaining * PI / 2.0)
            } else 1.0
            for (offset in samples.indices) {
                val white = random.nextDouble(-1.0, 1.0)
                p0 = 0.99886 * p0 + white * 0.0555179
                p1 = 0.99332 * p1 + white * 0.0750759
                p2 = 0.96900 * p2 + white * 0.1538520
                p3 = 0.86650 * p3 + white * 0.3104856
                p4 = 0.55000 * p4 + white * 0.5329522
                p5 = -0.7616 * p5 - white * 0.0168980
                val pink = (p0 + p1 + p2 + p3 + p4 + p5 + p6 + white * 0.5362) * 0.11
                p6 = white * 0.115926
                brown = (brown + 0.02 * white) / 1.02
                low += (pink - low) * 0.025

                if (index >= nextGust) {
                    gust = random.nextDouble(0.08, 0.25)
                    nextGust = index + sampleRate * (7 + random.nextInt(8))
                }
                gust *= 0.9997
                val time = index.toDouble() / sampleRate
                val tide = 0.73 + 0.17 * sin(2.0 * PI * time / 10.5) + 0.07 * sin(2.0 * PI * time / 17.0 + 1.7)
                if (random.nextDouble() < 0.000035) {
                    transientLevel = random.nextDouble(0.12, 0.42)
                    transientFrequency = random.nextDouble(900.0, 3600.0)
                    transientPhase = 0.0
                }
                val transient = sin(transientPhase) * transientLevel
                transientPhase += 2.0 * PI * transientFrequency / sampleRate
                transientLevel *= 0.9988
                if (random.nextDouble() < 0.000012) {
                    chirpLevel = random.nextDouble(0.06, 0.18)
                    chirpFrequency = random.nextDouble(1900.0, 3400.0)
                    chirpPhase = 0.0
                }
                val chirp = sin(chirpPhase) * chirpLevel
                chirpPhase += 2.0 * PI * chirpFrequency / sampleRate
                chirpLevel *= 0.9992

                var mixed = 0.0
                val currentScenes = scenes
                for (activeScene in currentScenes) {
                    val sceneGain: Double
                    val textured: Double
                    when (activeScene) {
                        "waves" -> {
                            sceneGain = tide + gust * 0.8
                            textured = brown * 0.76 + pink * 0.24
                        }
                        "river" -> {
                            sceneGain = 0.82 + 0.09 * sin(2.0 * PI * time / 6.0) + gust * 0.5
                            textured = white * 0.28 + pink * 0.47 + brown * 0.25
                        }
                        "fire" -> {
                            sceneGain = 0.72 + 0.08 * sin(2.0 * PI * time / 9.0)
                            textured = brown * 0.62 + pink * 0.30 + transient * 0.34
                        }
                        "wind" -> {
                            sceneGain = 0.70 + 0.26 * sin(2.0 * PI * time / 12.0) + gust
                            textured = brown * 0.68 + pink * 0.32
                        }
                        "forest" -> {
                            sceneGain = 0.78 + 0.11 * sin(2.0 * PI * time / 13.0) + gust * 0.7
                            textured = brown * 0.50 + pink * 0.40 + white * 0.10
                        }
                        "birds" -> {
                            sceneGain = 0.74 + 0.08 * sin(2.0 * PI * time / 16.0)
                            textured = brown * 0.30 + pink * 0.52 + chirp * 0.9
                        }
                        "night" -> {
                            val insectPulse = maxOf(0.0, sin(2.0 * PI * time / 1.7 - 0.8)).let { if (it > 0.82) 1.0 else 0.0 }
                            val insect = sin(2.0 * PI * 4100.0 * time) * insectPulse * 0.08
                            sceneGain = 0.72 + 0.06 * sin(2.0 * PI * time / 19.0)
                            textured = pink * 0.72 + brown * 0.23 + insect
                        }
                        "cafe" -> {
                            sceneGain = 0.79 + 0.07 * sin(2.0 * PI * time / 8.0) + gust * 0.35
                            textured = pink * 0.68 + low * 0.22 + white * 0.10
                        }
                        "window-rain" -> {
                            sceneGain = 0.77 + 0.08 * sin(2.0 * PI * time / 14.0) + gust * 0.3
                            textured = pink * 0.56 + low * 0.24 + white * 0.20 + transient * 0.08
                        }
                        "storm" -> {
                            val thunder = 0.65 + 0.35 * sin(2.0 * PI * time / 23.0)
                            sceneGain = thunder * (0.82 + 0.12 * sin(2.0 * PI * time / 8.0))
                            textured = brown * 0.58 + pink * 0.24 + white * 0.18
                        }
                        "white" -> {
                            sceneGain = 0.82
                            textured = white
                        }
                        "pink" -> {
                            sceneGain = 0.84
                            textured = pink
                        }
                        "brown" -> {
                            sceneGain = 0.85
                            textured = brown
                        }
                        else -> {
                            sceneGain = 0.79 + 0.08 * sin(2.0 * PI * time / 19.0) + gust * 0.35
                            textured = white * 0.48 + pink * 0.38 + brown * 0.14 + transient * 0.13
                        }
                    }
                    mixed += textured * sceneGain
                }
                val normalization = 1.0 / kotlin.math.sqrt(currentScenes.size.coerceAtLeast(1).toDouble())
                val amplitude = (volume * 0.22 * normalization * fade).coerceAtMost(0.38)
                samples[offset] = (mixed * amplitude * Short.MAX_VALUE).toInt()
                    .coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
                index++
            }
            if (track.write(samples, 0, samples.size) < 0) break
        }
    }

    private fun stopPlayback() {
        playing = false
        playbackGeneration++
        audioThread?.interrupt()
        audioThread = null
        val track = audioTrack
        audioTrack = null
        if (track != null) {
            try { track.pause() } catch (_: IllegalStateException) {}
            try { track.flush() } catch (_: IllegalStateException) {}
            track.release()
        }

        val manager = getSystemService(AudioManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { manager.abandonAudioFocusRequest(it) }
            audioFocusRequest = null
        } else {
            @Suppress("DEPRECATION")
            manager.abandonAudioFocus(null)
        }
    }

    private fun parseScenes(value: String?): List<String> {
        val allowed = setOf("rain", "window-rain", "storm", "waves", "river", "fire", "wind", "forest", "birds", "night", "cafe", "white", "pink", "brown")
        return value.orEmpty().split(',').map(String::trim).filter { it in allowed }.distinct().take(4)
    }

    private fun scheduleSleepStop(minutes: Int) {
        clearSleepTimer()
        if (minutes <= 0 || !playing) return
        val stopAt = System.currentTimeMillis() + minutes * 60_000L
        sleepStopAt = stopAt
        val stop = Runnable {
            sleepStopAt = 0L
            stopPlayback()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
        sleepStopRunnable = stop
        mainHandler.postDelayed(stop, minutes * 60_000L)
    }

    private fun clearSleepTimer() {
        sleepStopRunnable?.let(mainHandler::removeCallbacks)
        sleepStopRunnable = null
        sleepStopAt = 0L
    }

    override fun onDestroy() {
        clearSleepTimer()
        stopPlayback()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
