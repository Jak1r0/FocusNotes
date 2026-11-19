import { useCallback, useEffect, useRef, useState } from 'react'

export type NoiseScene = 'rain' | 'waves' | 'forest' | 'cafe' | 'pink'

export const NOISE_SCENES: Array<{ id: NoiseScene; label: string; hint: string; icon: string }> = [
  { id: 'rain', label: '雨声', hint: '细雨落在窗边', icon: 'rain' },
  { id: 'waves', label: '海浪', hint: '潮汐缓慢起伏', icon: 'waves' },
  { id: 'forest', label: '森林', hint: '风穿过树梢', icon: 'forest' },
  { id: 'cafe', label: '咖啡馆', hint: '低语与环境底噪', icon: 'cafe' },
  { id: 'pink', label: '粉红噪音', hint: '柔和宽频背景', icon: 'pink' },
]

interface Engine {
  ctx: AudioContext
  master: GainNode
  nodes: AudioNode[]
  timer: number | null
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

export interface WhiteNoiseApi {
  scene: NoiseScene | null
  volume: number
  playing: boolean
  scenes: typeof NOISE_SCENES
  start: (scene: NoiseScene) => void
  stop: () => void
  setVolume: (value: number) => void
}

export function useWhiteNoise(): WhiteNoiseApi {
  const engine = useRef<Engine | null>(null)
  const [scene, setScene] = useState<NoiseScene | null>(null)
  const [volume, setVolumeState] = useState(() => {
    const saved = Number(window.localStorage.getItem('focusnotes.noiseVolume') ?? 45)
    return Number.isFinite(saved) ? Math.min(100, Math.max(0, saved)) : 45
  })
  const [playing, setPlaying] = useState(false)

  const stop = useCallback(() => {
    const current = engine.current
    if (current) {
      if (current.timer) window.clearInterval(current.timer)
      current.nodes.forEach((node) => { try { if ('stop' in node) (node as AudioBufferSourceNode).stop() } catch { /* 已停止 */ } })
      void current.ctx.close().catch(() => undefined)
      engine.current = null
    }
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
    const white = noiseBuffer(ctx, 4, 'white')
    const pink = noiseBuffer(ctx, 4, 'pink')
    const brown = noiseBuffer(ctx, 4, 'brown')

    if (next === 'rain') {
      const rain = loopSource(ctx, white, 0.16, { type: 'bandpass', frequency: 1800, q: 0.5 })
      rain.gain.connect(master); nodes.push(rain.source, rain.gain); sources.push(rain.source)
      const low = loopSource(ctx, brown, 0.14, { type: 'lowpass', frequency: 420 })
      low.gain.connect(master); nodes.push(low.source, low.gain); sources.push(low.source)
    } else if (next === 'waves') {
      const surf = loopSource(ctx, white, 0.22, { type: 'lowpass', frequency: 700 })
      surf.gain.connect(master); nodes.push(surf.source, surf.gain); sources.push(surf.source)
      // 缓慢起伏的潮汐包络
      const timer = window.setInterval(() => {
        const t = ctx.currentTime
        surf.gain.gain.cancelScheduledValues(t)
        surf.gain.gain.setValueAtTime(surf.gain.gain.value, t)
        surf.gain.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.12, t + 3.5)
      }, 3600)
      engine.current = { ctx, master, nodes, timer }
    } else if (next === 'forest') {
      const wind = loopSource(ctx, brown, 0.24, { type: 'lowpass', frequency: 620 })
      wind.gain.connect(master); nodes.push(wind.source, wind.gain); sources.push(wind.source)
      const leaves = loopSource(ctx, pink, 0.1, { type: 'bandpass', frequency: 3200, q: 0.6 })
      leaves.gain.connect(master); nodes.push(leaves.source, leaves.gain); sources.push(leaves.source)
    } else if (next === 'cafe') {
      const murmur = loopSource(ctx, pink, 0.18, { type: 'bandpass', frequency: 900, q: 0.7 })
      murmur.gain.connect(master); nodes.push(murmur.source, murmur.gain); sources.push(murmur.source)
      const room = loopSource(ctx, brown, 0.1, { type: 'lowpass', frequency: 380 })
      room.gain.connect(master); nodes.push(room.source, room.gain); sources.push(room.source)
    } else {
      const soft = loopSource(ctx, pink, 0.3)
      soft.gain.connect(master); nodes.push(soft.source, soft.gain); sources.push(soft.source)
    }

    sources.forEach((source) => { try { source.start() } catch { /* 忽略 */ } })
    if (!engine.current) engine.current = { ctx, master, nodes, timer: null }
    void ctx.resume().catch(() => undefined)
    setScene(next)
    setPlaying(true)
  }, [stop, volume])

  const setVolume = useCallback((value: number) => {
    const next = Math.min(100, Math.max(0, value))
    setVolumeState(next)
    window.localStorage.setItem('focusnotes.noiseVolume', String(next))
    if (engine.current) engine.current.master.gain.value = next / 100
  }, [])

  useEffect(() => () => {
    const current = engine.current
    if (current) {
      if (current.timer) window.clearInterval(current.timer)
      void current.ctx.close().catch(() => undefined)
    }
  }, [])

  return { scene, volume, playing, scenes: NOISE_SCENES, start, stop, setVolume }
}
