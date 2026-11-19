import { useCallback, useEffect, useRef, useState } from 'react'
import type { FocusSession, WorkspacePreferences } from '@focusnotes/core'

export type PomodoroPhase = 'focus' | 'break'
export type PomodoroMode = 'countdown' | 'stopwatch'

export interface PomodoroTimerApi {
  mode: PomodoroMode
  phase: PomodoroPhase
  running: boolean
  remaining: number
  elapsed: number
  taskId: string
  setMode: (mode: PomodoroMode) => void
  setTaskId: (id: string) => void
  toggle: () => void
  reset: () => void
  finishStopwatch: () => void
}

function createId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `focus-${Date.now()}`
}

/**
 * Persistent pomodoro/stopwatch timer. Lives at the App level so it keeps
 * running when the user switches views (the PomodoroView itself unmounts).
 * Uses wall-clock timestamps instead of per-second increments, so the timer
 * stays accurate even when Chromium throttles setInterval in the background.
 */
export function usePomodoroTimer(
  preferences: WorkspacePreferences,
  onAddSession: (session: FocusSession) => void,
  onNotify: (title: string, body: string) => void,
): PomodoroTimerApi {
  const [mode, setModeState] = useState<PomodoroMode>('countdown')
  const [phase, setPhaseState] = useState<PomodoroPhase>('focus')
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(preferences.pomodoroMinutes * 60)
  const [elapsed, setElapsed] = useState(0)
  const [taskId, setTaskIdState] = useState('')

  const ref = useRef({ mode, phase, running, remaining, elapsed, taskId })
  ref.current = { mode, phase, running, remaining, elapsed, taskId }

  const prefsRef = useRef(preferences)
  prefsRef.current = preferences
  const callbacksRef = useRef({ onAddSession, onNotify })
  callbacksRef.current = { onAddSession, onNotify }

  const countdownEndAtRef = useRef<number | null>(null)
  const stopwatchStartAtRef = useRef<number | null>(null)
  const stopwatchAccumRef = useRef(0)

  const phaseDuration = (ph: PomodoroPhase): number =>
    (ph === 'focus' ? preferences.pomodoroMinutes : preferences.shortBreakMinutes) * 60

  const recordFocusSession = (seconds: number, associatedTaskId: string | null) => {
    callbacksRef.current.onAddSession({
      id: createId(),
      startedAt: new Date(Date.now() - seconds * 1000).toISOString(),
      endedAt: new Date().toISOString(),
      seconds,
      mode: 'focus',
      taskId: associatedTaskId,
    })
  }

  const completeCountdown = () => {
    const st = ref.current
    setRunning(false)
    countdownEndAtRef.current = null
    if (st.phase === 'focus') {
      recordFocusSession(phaseDuration('focus'), st.taskId || null)
      callbacksRef.current.onNotify('完成一个番茄', `专注 ${prefsRef.current.pomodoroMinutes} 分钟，起来活动一下。`)
      setPhaseState('break')
      setRemaining(phaseDuration('break'))
    } else {
      callbacksRef.current.onNotify('休息结束', '准备好开始下一个专注了吗？')
      setPhaseState('focus')
      setRemaining(phaseDuration('focus'))
    }
  }

  useEffect(() => {
    if (!running) return
    const interval = window.setInterval(() => {
      const st = ref.current
      if (st.mode === 'countdown') {
        if (countdownEndAtRef.current === null) countdownEndAtRef.current = Date.now() + st.remaining * 1000
        const left = Math.max(0, Math.ceil((countdownEndAtRef.current - Date.now()) / 1000))
        setRemaining(left)
        if (left <= 0) completeCountdown()
      } else {
        if (stopwatchStartAtRef.current === null) stopwatchStartAtRef.current = Date.now()
        const total = stopwatchAccumRef.current + (Date.now() - stopwatchStartAtRef.current)
        setElapsed(Math.floor(total / 1000))
      }
    }, 200)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const setMode = useCallback((next: PomodoroMode) => {
    setRunning(false)
    countdownEndAtRef.current = null
    stopwatchStartAtRef.current = null
    stopwatchAccumRef.current = 0
    setModeState(next)
    if (next === 'countdown') setRemaining(phaseDuration(ref.current.phase))
    else setElapsed(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.pomodoroMinutes, preferences.shortBreakMinutes])

  const setTaskId = useCallback((id: string) => setTaskIdState(id), [])

  const toggle = useCallback(() => {
    const st = ref.current
    if (st.mode === 'countdown') {
      if (st.running) {
        setRunning(false)
        countdownEndAtRef.current = null
      } else {
        countdownEndAtRef.current = Date.now() + st.remaining * 1000
        setRunning(true)
      }
    } else if (st.running) {
      setRunning(false)
      if (stopwatchStartAtRef.current !== null) {
        stopwatchAccumRef.current += Date.now() - stopwatchStartAtRef.current
        stopwatchStartAtRef.current = null
      }
    } else {
      stopwatchStartAtRef.current = Date.now()
      setRunning(true)
    }
  }, [])

  const reset = useCallback(() => {
    setRunning(false)
    countdownEndAtRef.current = null
    stopwatchStartAtRef.current = null
    stopwatchAccumRef.current = 0
    setPhaseState('focus')
    setRemaining(phaseDuration('focus'))
    setElapsed(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.pomodoroMinutes])

  const finishStopwatch = useCallback(() => {
    const st = ref.current
    setRunning(false)
    if (st.elapsed < 5) {
      stopwatchStartAtRef.current = null
      stopwatchAccumRef.current = 0
      setElapsed(0)
      return
    }
    recordFocusSession(st.elapsed, st.taskId || null)
    callbacksRef.current.onNotify('已记录专注', `本次专注 ${Math.round(st.elapsed / 60)} 分钟。`)
    stopwatchStartAtRef.current = null
    stopwatchAccumRef.current = 0
    setElapsed(0)
  }, [])

  return { mode, phase, running, remaining, elapsed, taskId, setMode, setTaskId, toggle, reset, finishStopwatch }
}
