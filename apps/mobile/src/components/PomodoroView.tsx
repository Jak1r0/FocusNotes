import { useEffect, useMemo, useRef } from 'react'
import { Alert, Animated, StyleSheet, useWindowDimensions } from 'react-native'
import { ThemedPressable as Pressable, ThemedText as Text, ThemedView as View } from '../theme'
import Svg, { Circle } from 'react-native-svg'
import { Brain, CheckCircle2, Coffee, Minus, Pause, Play, Plus, RotateCcw, Square, Timer, Volume2, VolumeX } from 'lucide-react-native'
import { focusStats, type FocusSession, type TodoItem, type WorkspacePreferences } from '@focusnotes/core'
import type { PomodoroTimerApi } from '../usePomodoroTimer'
import { useWhiteNoise } from '../useWhiteNoise'

interface Props {
  preferences: WorkspacePreferences
  sessions: FocusSession[]
  tasks: TodoItem[]
  timer: PomodoroTimerApi
  onAdjustFocusMinutes(minutes: number): void
  onToggleTimer(): void
  onRequestNotification(): Promise<void>
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function PomodoroView({ preferences, sessions, tasks, timer, onAdjustFocusMinutes, onToggleTimer, onRequestNotification }: Props) {
  const { mode, phase, running, remaining, elapsed, taskId, setMode, setTaskId, toggle, reset, finishStopwatch } = timer
  const noise = useWhiteNoise()
  const { width, height } = useWindowDimensions()
  const cloudMotion = useRef(new Animated.Value(0)).current
  const stats = useMemo(() => focusStats(sessions), [sessions])
  const openTasks = tasks.filter((task) => !task.completed && !task.deleted)
  const recent = [...sessions].filter((session) => session.mode === 'focus').slice(-5).reverse()
  const total = (phase === 'focus' ? preferences.pomodoroMinutes : preferences.shortBreakMinutes) * 60
  const displaySeconds = mode === 'stopwatch' ? elapsed : remaining
  const progress = mode === 'stopwatch'
    ? Math.min(1, elapsed / Math.max(1, preferences.pomodoroMinutes * 60))
    : total > 0 ? Math.max(0, Math.min(1, 1 - remaining / total)) : 0
  const size = Math.max(212, Math.min(width - 76, height * 0.35, 286))
  const radius = size * 0.43
  const circumference = 2 * Math.PI * radius

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(cloudMotion, { toValue: 1, duration: 4400, useNativeDriver: true }),
      Animated.timing(cloudMotion, { toValue: 0, duration: 4400, useNativeDriver: true }),
    ]))
    animation.start()
    return () => animation.stop()
  }, [cloudMotion])

  function chooseMode(next: 'countdown' | 'stopwatch') {
    if (running) toggle()
    setMode(next)
  }

  return <View style={styles.container}>
    <View style={styles.timerCard}>
      <View style={styles.modeSelector}>
        {(['countdown', 'stopwatch'] as const).map((item) => <Pressable key={item} style={[styles.modeChip, mode === item && styles.modeChipSelected]} onPress={() => chooseMode(item)}>
          <Text style={[styles.modeText, mode === item && styles.modeTextSelected]}>{item === 'countdown' ? '番茄计时' : '正计时'}</Text>
        </Pressable>)}
      </View>

      <View style={[styles.phasePill, phase === 'break' && styles.phaseBreak]}>
        {phase === 'focus' ? <Brain size={14} color="#0071e3" /> : <Coffee size={14} color="#248a52" />}
        <Text style={[styles.phaseText, phase === 'break' && styles.phaseBreakText]}>{phase === 'focus' ? '专注' : '短休息'}</Text>
        <Text style={styles.phaseDivider}>·</Text>
        <Text style={styles.phaseCaption}>{mode === 'countdown' ? `${Math.round(total / 60)} 分钟` : '自由计时'}</Text>
      </View>

      <View style={[styles.timerDial, { width: size, height: size }]}>
        <Animated.View style={[
          styles.cloud,
          styles.cloudBack,
          { transform: [{ translateX: cloudMotion.interpolate({ inputRange: [0, 1], outputRange: [-9, 9] }) }, { scale: cloudMotion.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.07] }) }] },
        ]} />
        <Animated.View style={[
          styles.cloud,
          styles.cloudFront,
          { transform: [{ translateX: cloudMotion.interpolate({ inputRange: [0, 1], outputRange: [8, -8] }) }, { scale: cloudMotion.interpolate({ inputRange: [0, 1], outputRange: [1.06, 0.95] }) }] },
        ]} />
        <Svg width={size} height={size} style={styles.ring}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#e9eef5" strokeWidth={4} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={phase === 'break' ? '#38a66a' : '#0071e3'}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - progress)}
            fill="none"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={styles.timerCenter}>
          <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.clock, { fontSize: Math.min(48, size * 0.21) }]}>{formatClock(displaySeconds)}</Text>
          <Text style={styles.timerHint}>{running ? (mode === 'countdown' ? '保持专注' : '正在计时') : displaySeconds === total && mode === 'countdown' ? '准备好了就开始' : '已暂停'}</Text>
        </View>
      </View>

      {mode === 'countdown' && !running && phase === 'focus' && <View style={styles.durationAdjust}>
        <Text style={styles.durationLabel}>专注时长</Text>
        <Pressable style={styles.adjustButton} onPress={() => onAdjustFocusMinutes(Math.max(1, preferences.pomodoroMinutes - 5))} accessibilityLabel="减少专注时长"><Minus size={15} color="#6e6e73" /></Pressable>
        <Text style={styles.durationValue}>{preferences.pomodoroMinutes} 分钟</Text>
        <Pressable style={styles.adjustButton} onPress={() => onAdjustFocusMinutes(Math.min(180, preferences.pomodoroMinutes + 5))} accessibilityLabel="增加专注时长"><Plus size={15} color="#6e6e73" /></Pressable>
      </View>}

      <View style={styles.controls}>
        <Pressable style={styles.primaryButton} onPress={onToggleTimer}>
          {running ? <Pause size={17} color="#fff" /> : <Play size={17} color="#fff" />}
          <Text style={styles.primaryText}>{running ? '暂停' : '开始'}</Text>
        </Pressable>
        {mode === 'stopwatch' && elapsed >= 5 && <Pressable style={styles.secondaryButton} onPress={finishStopwatch}><Square size={14} color="#48484a" /><Text style={styles.secondaryText}>结束并记录</Text></Pressable>}
        <Pressable style={styles.resetButton} onPress={reset} accessibilityLabel="重置计时"><RotateCcw size={17} color="#6e6e73" /></Pressable>
      </View>

      <View style={styles.notificationHint}>
        <Timer size={14} color="#0071e3" />
        <Text style={styles.notificationText}>开始后，Android 通知栏将实时显示剩余时间</Text>
      </View>

      {openTasks.length > 0 && <View style={styles.taskSection}>
        <Text style={styles.sectionLabel}>关联任务</Text>
        <View style={styles.taskPills}>
          <Pressable style={[styles.taskPill, !taskId && styles.selectedTaskPill]} onPress={() => setTaskId('')}><Text style={[styles.taskPillText, !taskId && styles.selectedTaskText]}>自由专注</Text></Pressable>
          {openTasks.slice(0, 12).map((task) => <Pressable key={task.id} style={[styles.taskPill, taskId === task.id && styles.selectedTaskPill]} onPress={() => setTaskId(task.id)}>
            <Text numberOfLines={1} style={[styles.taskPillText, taskId === task.id && styles.selectedTaskText]}>{task.title}</Text>
          </Pressable>)}
        </View>
      </View>}
    </View>

    <View style={styles.statsGrid}>
      <View style={styles.stat}><Text style={styles.statLabel}>今日番茄</Text><Text style={styles.statValue}>{stats.todayCount}<Text style={styles.statUnit}> / {preferences.dailyGoal}</Text></Text></View>
      <View style={styles.stat}><Text style={styles.statLabel}>今日专注</Text><Text style={styles.statValue}>{stats.todayMinutes}<Text style={styles.statUnit}> 分钟</Text></Text></View>
      <View style={styles.stat}><Text style={styles.statLabel}>本周专注</Text><Text style={styles.statValue}>{stats.weekMinutes}<Text style={styles.statUnit}> 分钟</Text></Text></View>
    </View>

    <View style={styles.noiseCard}>
      <View style={styles.noiseHeader}>
        <View style={styles.noiseTitle}><Text style={styles.noiseIcon}>〰</Text><Text style={styles.sectionTitle}>白噪音</Text></View>
        {noise.playing && <Pressable style={styles.stopNoise} onPress={noise.stop}><VolumeX size={14} color="#6e6e73" /><Text style={styles.stopNoiseText}>停止</Text></Pressable>}
      </View>
      <Text style={styles.noiseHint}>自然起伏的连续环境音，支持后台播放</Text>
      <Text style={styles.noiseHint}>可同时混搭 4 种声音；音色为本机实时合成</Text>
      <View style={styles.noiseGrid}>
        {noise.scenes.map((item) => {
          const active = noise.selectedScenes.includes(item.id)
          return <Pressable key={item.id} style={[styles.noiseScene, active && styles.noiseSceneActive]} onPress={() => {
            const toggle = () => {
              try { noise.toggleScene(item.id) }
              catch (error) { Alert.alert('白噪音播放失败', error instanceof Error ? error.message : '请稍后重试。') }
            }
            if (!noise.playing && !active) {
              void onRequestNotification().then(toggle).catch((error: unknown) => Alert.alert('白噪音播放失败', error instanceof Error ? error.message : '请稍后重试。'))
            } else toggle()
          }}>
            <Text style={styles.noiseEmoji}>{item.emoji}</Text>
            <Text style={[styles.noiseName, active && styles.noiseNameActive]}>{item.label}</Text>
          </Pressable>
        })}
      </View>
      <View style={styles.volumeRow}>
        <Volume2 size={16} color="#6e6e73" />
        <Pressable style={styles.volumeAdjust} onPress={() => noise.adjustVolume(-10)} accessibilityLabel="降低音量"><Minus size={14} color="#6e6e73" /></Pressable>
        <View style={styles.volumeTrack}><View style={[styles.volumeFill, { width: `${noise.volume}%` }]} /></View>
        <Pressable style={styles.volumeAdjust} onPress={() => noise.adjustVolume(10)} accessibilityLabel="提高音量"><Plus size={14} color="#6e6e73" /></Pressable>
        <Text style={styles.volumeValue}>{noise.volume}%</Text>
      </View>
      <View style={styles.sleepRow}>
        <Text style={styles.sleepLabel}>睡眠定时</Text>
        {([15, 30, 60] as const).map((minutes) => <Pressable
          key={minutes}
          disabled={!noise.playing}
          style={[styles.sleepOption, noise.sleepMinutes === minutes && styles.sleepOptionActive, !noise.playing && styles.sleepOptionDisabled]}
          onPress={() => {
            try { noise.setSleepTimer(noise.sleepMinutes === minutes ? null : minutes) }
            catch (error) { Alert.alert('睡眠定时设置失败', error instanceof Error ? error.message : '请稍后重试。') }
          }}
        ><Text style={[styles.sleepOptionText, noise.sleepMinutes === minutes && styles.sleepOptionTextActive]}>{minutes} 分钟</Text></Pressable>)}
      </View>
    </View>

    <View style={styles.recordsCard}>
      <View style={styles.recordsHeader}><View style={styles.noiseTitle}><Timer size={15} color="#0071e3" /><Text style={styles.sectionTitle}>专注记录</Text></View><Text style={styles.recordCount}>{recent.length} 条</Text></View>
      {recent.length === 0 ? <View style={styles.emptyRecords}>
        <CheckCircle2 size={25} color="#a1a1aa" /><Text style={styles.emptyRecordsText}>完成第一个番茄后，记录会显示在这里。</Text>
      </View> : recent.map((session) => {
        const task = tasks.find((item) => item.id === session.taskId)
        const startedAt = new Date(session.startedAt)
        return <View style={styles.recordRow} key={session.id}>
          <View style={styles.recordDot} />
          <View style={styles.recordInfo}><Text style={styles.recordTask} numberOfLines={1}>{task?.title ?? '自由专注'}</Text><Text style={styles.recordTime}>{startedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · {Math.max(1, Math.round(session.seconds / 60))} 分钟</Text></View>
          <Text style={styles.recordBadge}>完成</Text>
        </View>
      })}
    </View>
  </View>
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  timerCard: { alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, borderRadius: 18, backgroundColor: '#fff' },
  modeSelector: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 22, backgroundColor: '#f2f2f7' },
  modeChip: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 18 },
  modeChipSelected: { backgroundColor: '#fff' },
  modeText: { color: '#8e8d93', fontSize: 12 },
  modeTextSelected: { color: '#1d1d1f', fontWeight: '600' },
  phasePill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#edf5ff' },
  phaseBreak: { backgroundColor: '#edf8f1' },
  phaseText: { color: '#0071e3', fontSize: 12, fontWeight: '600' },
  phaseBreakText: { color: '#248a52' },
  phaseDivider: { color: '#a1a1aa', fontSize: 13 },
  phaseCaption: { color: '#6e6e73', fontSize: 11 },
  timerDial: { alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  ring: { position: 'absolute' },
  cloud: { position: 'absolute', width: '63%', height: '45%', borderRadius: 999 },
  cloudBack: { backgroundColor: 'rgba(0,113,227,0.07)' },
  cloudFront: { width: '48%', height: '56%', backgroundColor: 'rgba(101,173,255,0.09)' },
  timerCenter: { alignItems: 'center', justifyContent: 'center' },
  clock: { color: '#1d1d1f', fontWeight: '300', fontVariant: ['tabular-nums'], letterSpacing: -1.5 },
  timerHint: { marginTop: 3, color: '#8e8d93', fontSize: 11 },
  durationAdjust: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -7 },
  durationLabel: { color: '#8e8d93', fontSize: 11 },
  adjustButton: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#f5f5f7' },
  durationValue: { minWidth: 54, color: '#48484a', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 14 },
  primaryButton: { minWidth: 124, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20, borderRadius: 24, backgroundColor: '#0071e3' },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  secondaryButton: { height: 42, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, borderRadius: 22, backgroundColor: '#f2f2f7' },
  secondaryText: { color: '#48484a', fontSize: 11 },
  resetButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#f2f2f7' },
  notificationHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  notificationText: { color: '#8e8d93', fontSize: 10 },
  taskSection: { width: '100%', marginTop: 15 },
  sectionLabel: { marginBottom: 7, color: '#8e8d93', fontSize: 10 },
  taskPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  taskPill: { maxWidth: '100%', minHeight: 30, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 16, backgroundColor: '#f5f5f7' },
  selectedTaskPill: { backgroundColor: '#eaf3ff' },
  taskPillText: { color: '#6e6e73', fontSize: 10 },
  selectedTaskText: { color: '#0071e3', fontWeight: '600' },
  statsGrid: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minHeight: 78, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#fff' },
  statLabel: { color: '#8e8d93', fontSize: 10 },
  statValue: { marginTop: 5, color: '#1d1d1f', fontSize: 19, fontWeight: '600' },
  statUnit: { color: '#8e8d93', fontSize: 10, fontWeight: '400' },
  noiseCard: { padding: 16, borderRadius: 16, backgroundColor: '#fff' },
  noiseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noiseTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  noiseIcon: { color: '#0071e3', fontSize: 17 },
  sectionTitle: { color: '#1d1d1f', fontSize: 13, fontWeight: '600' },
  stopNoise: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, borderRadius: 17, backgroundColor: '#f5f5f7' },
  stopNoiseText: { color: '#6e6e73', fontSize: 10 },
  noiseHint: { marginTop: 5, color: '#a1a1aa', fontSize: 10 },
  noiseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  noiseScene: { flex: 1, minWidth: '28%', minHeight: 65, alignItems: 'center', justifyContent: 'center', gap: 3, borderWidth: 1, borderColor: '#ebebef', borderRadius: 12, backgroundColor: '#fafafc' },
  noiseSceneActive: { borderColor: '#9ccaff', backgroundColor: '#eff6ff' },
  noiseEmoji: { fontSize: 19 },
  noiseName: { color: '#6e6e73', fontSize: 10 },
  noiseNameActive: { color: '#0071e3', fontWeight: '600' },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  volumeAdjust: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#f5f5f7' },
  volumeTrack: { flex: 1, height: 5, overflow: 'hidden', borderRadius: 3, backgroundColor: '#e5e5ea' },
  volumeFill: { height: '100%', borderRadius: 3, backgroundColor: '#0071e3' },
  volumeValue: { width: 34, color: '#6e6e73', fontSize: 10, textAlign: 'right' },
  sleepRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  sleepLabel: { marginRight: 2, color: '#8e8d93', fontSize: 10 },
  sleepOption: { minHeight: 31, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 16, backgroundColor: '#f5f5f7' },
  sleepOptionActive: { backgroundColor: '#eaf3ff' },
  sleepOptionDisabled: { opacity: 0.55 },
  sleepOptionText: { color: '#6e6e73', fontSize: 10 },
  sleepOptionTextActive: { color: '#0071e3', fontWeight: '600' },
  recordsCard: { padding: 16, borderRadius: 16, backgroundColor: '#fff' },
  recordsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recordCount: { color: '#a1a1aa', fontSize: 10 },
  emptyRecords: { minHeight: 98, alignItems: 'center', justifyContent: 'center', gap: 9 },
  emptyRecordsText: { color: '#8e8d93', fontSize: 11, textAlign: 'center' },
  recordRow: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f2' },
  recordDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#30a46c' },
  recordInfo: { flex: 1 },
  recordTask: { color: '#48484a', fontSize: 12, fontWeight: '500' },
  recordTime: { marginTop: 4, color: '#a1a1aa', fontSize: 10 },
  recordBadge: { color: '#248a52', fontSize: 10 },
})
