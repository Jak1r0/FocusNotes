import { useCallback, useEffect, useRef, useState } from 'react'
import type { FocusSession, WorkspacePreferences } from '@focusnotes/core'

export type TimerMode = 'countdown' | 'stopwatch'
export type TimerPhase = 'focus' | 'break'

export interface PomodoroTimerApi {
  mode: TimerMode
  phase: TimerPhase
  running: boolean
  remaining: number
  elapsed: number
  taskId: string
  setMode(mode: TimerMode): void
  setTaskId(id: string): void
  toggle(): void
  reset(): void
  finishStopwatch(): void
}

function createId(): string {
  return `focus-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function usePomodoroTimer(
  preferences: WorkspacePreferences,
  addSession: (session: FocusSession) => Promise<void>,
): PomodoroTimerApi {
  const [mode, setMode] = useState<TimerMode>('countdown')
  const [phase, setPhase] = useState<TimerPhase>('focus')
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(preferences.pomodoroMinutes * 60)
  const [elapsed, setElapsed] = useState(0)
  const [taskId, setTaskId] = useState('')
  const state = useRef({ mode, phase, running, remaining, elapsed, taskId })
  state.current = { mode, phase, running, remaining, elapsed, taskId }
  const preferencesRef = useRef(preferences)
  preferencesRef.current = preferences
  const addSessionRef = useRef(addSession)
  addSessionRef.current = addSession
  const deadline = useRef<number | null>(null)
  const startedAt = useRef<number | null>(null)
  const elapsedBeforeStart = useRef(0)

  const duration = useCallback((nextPhase: TimerPhase) => (
    (nextPhase === 'focus' ? preferencesRef.current.pomodoroMinutes : preferencesRef.current.shortBreakMinutes) * 60
  ), [])

  const saveFocusSession = useCallback((seconds: number, forTask: string) => {
    if (seconds < 5) return
    const ended = Date.now()
    void addSessionRef.current({
      id: createId(),
      startedAt: new Date(ended - seconds * 1000).toISOString(),
      endedAt: new Date(ended).toISOString(),
      seconds,
      mode: 'focus',
      taskId: forTask || null,
    }).catch((error: unknown) => console.error('Unable to save focus session', error))
  }, [])

  useEffect(() => {
    if (!running && mode === 'countdown') setRemaining(duration(phase))
  }, [duration, mode, phase, preferences.pomodoroMinutes, preferences.shortBreakMinutes, running])

  useEffect(() => {
    if (!running) return
    const interval = setInterval(() => {
      const current = state.current
      if (current.mode === 'countdown') {
        if (deadline.current === null) deadline.current = Date.now() + current.remaining * 1000
        const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))
        setRemaining(left)
        if (left === 0) {
          setRunning(false)
          deadline.current = null
          if (current.phase === 'focus') {
            saveFocusSession(duration('focus'), current.taskId)
            setPhase('break')
            setRemaining(duration('break'))
            return
          }
          setPhase('focus')
          setRemaining(duration('focus'))
        }
      } else {
        if (startedAt.current === null) startedAt.current = Date.now()
        setElapsed(elapsedBeforeStart.current + Math.floor((Date.now() - startedAt.current) / 1000))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [duration, running, saveFocusSession])

  const switchMode = useCallback((next: TimerMode) => {
    setRunning(false)
    deadline.current = null
    startedAt.current = null
    elapsedBeforeStart.current = 0
    setMode(next)
    setPhase('focus')
    if (next === 'countdown') {
      setRemaining(preferencesRef.current.pomodoroMinutes * 60)
      setElapsed(0)
    } else {
      setElapsed(0)
    }
  }, [])

  const toggle = useCallback(() => {
    const current = state.current
    if (current.running) {
      if (current.mode === 'countdown' && deadline.current !== null) {
        setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)))
        deadline.current = null
      } else if (current.mode === 'stopwatch' && startedAt.current !== null) {
        elapsedBeforeStart.current += Date.now() - startedAt.current
        startedAt.current = null
        setElapsed(Math.floor(elapsedBeforeStart.current / 1000))
      }
      setRunning(false)
      return
    }
    if (current.mode === 'countdown') deadline.current = Date.now() + current.remaining * 1000
    else startedAt.current = Date.now()
    setRunning(true)
  }, [])

  const reset = useCallback(() => {
    setRunning(false)
    deadline.current = null
    startedAt.current = null
    elapsedBeforeStart.current = 0
    setPhase('focus')
    setRemaining(preferencesRef.current.pomodoroMinutes * 60)
    setElapsed(0)
  }, [])

  const finishStopwatch = useCallback(() => {
    const current = state.current
    const total = current.running && startedAt.current !== null
      ? elapsedBeforeStart.current + Date.now() - startedAt.current
      : elapsedBeforeStart.current
    setRunning(false)
    saveFocusSession(Math.floor(total / 1000), current.taskId)
    startedAt.current = null
    elapsedBeforeStart.current = 0
    setElapsed(0)
  }, [saveFocusSession])

  return { mode, phase, running, remaining, elapsed, taskId, setMode: switchMode, setTaskId, toggle, reset, finishStopwatch }
}
