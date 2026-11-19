import { useCallback, useEffect, useRef, useState } from 'react'
import { sleepTimerRemaining } from '@focusnotes/core'

export type NoiseScene = 'rain' | 'waves' | 'forest' | 'cafe' | 'pink' | 'thunder' | 'fire' | 'waterfall' | 'birds' | 'brown'

export const NOISE_SCENES: Array<{ id: NoiseScene; label: string; hint: string; icon: string }> = [
  { id: 'rain', label: '雨声', hint: '细雨落在窗边', icon: 'rain' },
  { id: 'waves', label: '海浪', hint: '潮汐缓慢起伏', icon: 'waves' },
  { id: 'forest', label: '森林', hint: '风穿过树梢', icon: 'forest' },
  { id: 'cafe', label: '咖啡馆', hint: '低语与环境底噪', icon: 'cafe' },
  { id: 'pink', label: '粉红噪音', hint: '柔和宽频背景', icon: 'pink' },
  { id: 'thunder', label: '雷声', hint: '远方闷雷与雨幕', icon: 'thunder' },
  { id: 'fire', label: '篝火', hint: '木柴噼啪作响', icon: 'fire' },
  { id: 'waterfall', label: '瀑布', hint: '水流奔涌轰鸣', icon: 'waterfall' },
  { id: 'birds', label: '鸟鸣', hint: '林间清脆啁啾', icon: 'birds' },
  { id: 'brown', label: '棕噪音', hint: '低沉宽频背景', icon: 'brown' },
]

export const SLEEP_OPTIONS = [15, 30, 45, 60, 90] as const
export type SleepMinutes = (typeof SLEEP_OPTIONS)[number]

interface Engine {
  ctx: AudioContext
  master: GainNode
  nodes: AudioNode[]
  timer: number | null
  sources: AudioBufferSourceNode[]
  cancelled: { value: boolean }
}

function noiseBuffer(ctx: AudioContext, seconds: number, kind: 'white' | 'pink' | 'brown' = 'white'): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  let last = 0
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1
    if (kind === 'pink') {
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      b3 = 0.8665 * b3 + white * 0.3104856
      b4 = 0.55 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.016898
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
      b6 = white * 0.115926
    } else if (kind === 'brown') {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    } else {
      data[i] = white
    }
  }
  return buffer
}

function loopSource(ctx: AudioContext, buffer: AudioBuffer, gainValue: number, filter?: { type: BiquadFilterType; frequency: number; q?: number }): { source: AudioBufferSourceNode; gain: GainNode } {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  const gain = ctx.createGain()
  gain.gain.value = gainValue
  if (filter) {
    const biquad = ctx.createBiquadFilter()
    biquad.type = filter.type
    biquad.frequency.value = filter.frequency
    if (filter.q) biquad.Q.value = filter.q
    source.connect(biquad).connect(gain)
  } else {
    source.connect(gain)
  }
  return { source, gain }
}

/** 生成有节奏的脉冲包络（雷声/鸟鸣/篝火噼啪），用定时器调度随机事件。 */
function pulse(ctx: AudioContext, gain: GainNode, min: number, max: number, level: number, ramp: number, alive: () => boolean) {
  if (!alive()) return
  const t = ctx.currentTime
  gain.gain.cancelScheduledValues(t)
  gain.gain.setValueAtTime(gain.gain.value, t)
  gain.gain.linearRampToValueAtTime(level, t + ramp)
  gain.gain.linearRampToValueAtTime(0, t + ramp + min / 1000)
  window.setTimeout(() => pulse(ctx, gain, min, max, level, ramp, alive), min + Math.random() * (max - min))
}

export interface WhiteNoiseApi {
  scene: NoiseScene | null
  volume: number
  playing: boolean
  scenes: typeof NOISE_SCENES
  sleepMinutes: SleepMinutes | null
  sleepRemaining: number
  start: (scene: NoiseScene) => void
  stop: () => void
  setVolume: (value: number) => void
  setSleep: (minutes: SleepMinutes | null) => void
}

const FADE_SECONDS = 15

export function useWhiteNoise(): WhiteNoiseApi {
  const engine = useRef<Engine | null>(null)
  const sleepStartedAt = useRef<number | null>(null)
  const fadeStarted = useRef(false)
  const [scene, setScene] = useState<NoiseScene | null>(null)
  const [volume, setVolumeState] = useState(() => {
    const saved = Number(window.localStorage.getItem('focusnotes.noiseVolume') ?? 45)
    return Number.isFinite(saved) ? Math.min(100, Math.max(0, saved)) : 45
  })
  const [playing, setPlaying] = useState(false)
  const [sleepMinutes, setSleepMinutesState] = useState<SleepMinutes | null>(() => {
    const saved = Number(window.localStorage.getItem('focusnotes.noiseSleep'))
    return SLEEP_OPTIONS.includes(saved as SleepMinutes) ? saved as SleepMinutes : null
  })
  const [sleepRemaining, setSleepRemaining] = useState(0)

  const stop = useCallback(() => {
    const current = engine.current
    if (current) {
      if (current.timer) window.clearInterval(current.timer)
      current.sources.forEach((source) => { try { source.stop() } catch { /* 已停止 */ } })
      void current.ctx.close().catch(() => undefined)
      current.cancelled.value = true
      engine.current = null
    }
    sleepStartedAt.current = null
    fadeStarted.current = false
    setSleepRemaining(0)
    setPlaying(false)
  }, [])

  const start = useCallback((next: NoiseScene) => {
    stop()
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    const master = ctx.createGain()
    master.gain.value = volume / 100
    master.connect(ctx.destination)
    const nodes: AudioNode[] = [master]
    const sources: AudioBufferSourceNode[] = []
    let timer: number | null = null
    const cancelled = { value: false }
    const white = noiseBuffer(ctx, 4, 'white')
    const pink = noiseBuffer(ctx, 4, 'pink')
    const brown = noiseBuffer(ctx, 4, 'brown')

    const attach = (item: { source: AudioBufferSourceNode; gain: GainNode }) => {
      item.gain.connect(master); nodes.push(item.source, item.gain); sources.push(item.source)
      return item
    }

    if (next === 'rain') {
      attach(loopSource(ctx, white, 0.16, { type: 'bandpass', frequency: 1800, q: 0.5 }))
      attach(loopSource(ctx, brown, 0.14, { type: 'lowpass', frequency: 420 }))
    } else if (next === 'waves') {
      const surf = attach(loopSource(ctx, white, 0.22, { type: 'lowpass', frequency: 700 }))
      timer = window.setInterval(() => {
        const t = ctx.currentTime
        surf.gain.gain.cancelScheduledValues(t)
        surf.gain.gain.setValueAtTime(surf.gain.gain.value, t)
        surf.gain.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.12, t + 3.5)
      }, 3600)
    } else if (next === 'forest') {
      attach(loopSource(ctx, brown, 0.24, { type: 'lowpass', frequency: 620 }))
      attach(loopSource(ctx, pink, 0.1, { type: 'bandpass', frequency: 3200, q: 0.6 }))
    } else if (next === 'cafe') {
      attach(loopSource(ctx, pink, 0.18, { type: 'bandpass', frequency: 900, q: 0.7 }))
      attach(loopSource(ctx, brown, 0.1, { type: 'lowpass', frequency: 380 }))
    } else if (next === 'thunder') {
      attach(loopSource(ctx, brown, 0.12, { type: 'lowpass', frequency: 500 }))
      const rumble = attach(loopSource(ctx, brown, 0, { type: 'lowpass', frequency: 180 }))
      timer = window.setTimeout(() => pulse(ctx, rumble.gain, 2200, 5200, 0.55, 0.4, () => !cancelled.value)) as unknown as number
    } else if (next === 'fire') {
      attach(loopSource(ctx, brown, 0.12, { type: 'lowpass', frequency: 480 }))
      const crackle = attach(loopSource(ctx, white, 0, { type: 'bandpass', frequency: 4200, q: 1.2 }))
      timer = window.setTimeout(() => pulse(ctx, crackle.gain, 120, 480, 0.22, 0.02, () => !cancelled.value)) as unknown as number
    } else if (next === 'waterfall') {
      attach(loopSource(ctx, white, 0.22, { type: 'lowpass', frequency: 2400 }))
      attach(loopSource(ctx, brown, 0.18, { type: 'lowpass', frequency: 520 }))
    } else if (next === 'birds') {
      attach(loopSource(ctx, pink, 0.08, { type: 'bandpass', frequency: 2600, q: 0.8 }))
      const chirp = attach(loopSource(ctx, white, 0, { type: 'bandpass', frequency: 3800, q: 3 }))
      timer = window.setTimeout(() => pulse(ctx, chirp.gain, 800, 2600, 0.16, 0.06, () => !cancelled.value)) as unknown as number
    } else {
      const base = next === 'brown' ? brown : pink
      attach(loopSource(ctx, base, next === 'brown' ? 0.3 : 0.3))
    }

    sources.forEach((source) => { try { source.start() } catch { /* 忽略 */ } })
    engine.current = { ctx, master, nodes, timer, sources, cancelled }
    void ctx.resume().catch(() => undefined)
    // 新场景沿用已设定的睡眠定时，重新计时
    if (sleepMinutes) sleepStartedAt.current = Date.now()
    fadeStarted.current = false
    setScene(next)
    setPlaying(true)
  }, [stop, volume, sleepMinutes])

  const setVolume = useCallback((value: number) => {
    const next = Math.min(100, Math.max(0, value))
    setVolumeState(next)
    window.localStorage.setItem('focusnotes.noiseVolume', String(next))
    if (engine.current) engine.current.master.gain.value = next / 100
  }, [])

  const setSleep = useCallback((minutes: SleepMinutes | null) => {
    setSleepMinutesState(minutes)
    if (minutes === null) window.localStorage.removeItem('focusnotes.noiseSleep')
    else window.localStorage.setItem('focusnotes.noiseSleep', String(minutes))
    sleepStartedAt.current = minutes && engine.current ? Date.now() : null
    fadeStarted.current = false
    setSleepRemaining(minutes ? minutes * 60_000 : 0)
  }, [])

  // 睡眠定时：每秒用 core 纯函数判定剩余时间，末段淡出后自动停止。
  useEffect(() => {
    if (!playing || !sleepMinutes) return
    const interval = window.setInterval(() => {
      const started = sleepStartedAt.current
      if (!started || !engine.current) return
      const remaining = sleepTimerRemaining(started, sleepMinutes, new Date())
      setSleepRemaining(Math.max(0, remaining))
      if (remaining <= 0) { stop(); return }
      if (remaining <= FADE_SECONDS * 1000 && !fadeStarted.current) {
        fadeStarted.current = true
        const t = engine.current.ctx.currentTime
        engine.current.master.gain.cancelScheduledValues(t)
        engine.current.master.gain.setValueAtTime(engine.current.master.gain.value, t)
        engine.current.master.gain.linearRampToValueAtTime(0, t + FADE_SECONDS)
      }
    }, 1000)
    return () => window.clearInterval(interval)
  }, [playing, sleepMinutes, stop])

  useEffect(() => () => {
    const current = engine.current
    if (current) {
      if (current.timer) window.clearInterval(current.timer)
      void current.ctx.close().catch(() => undefined)
    }
  }, [])

  return { scene, volume, playing, scenes: NOISE_SCENES, sleepMinutes, sleepRemaining, start, stop, setVolume, setSleep }
}
