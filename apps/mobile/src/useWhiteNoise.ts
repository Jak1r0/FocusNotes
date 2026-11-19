import { useCallback, useState } from 'react'
import { NativeModules } from 'react-native'

export type NoiseScene =
  | 'rain' | 'window-rain' | 'storm' | 'waves' | 'river' | 'fire'
  | 'wind' | 'forest' | 'birds' | 'night' | 'cafe' | 'white' | 'pink' | 'brown'

export const NOISE_SCENES: Array<{ id: NoiseScene; label: string; hint: string; emoji: string }> = [
  { id: 'rain', label: '细雨', hint: '疏密变化的雨点', emoji: '🌧️' },
  { id: 'window-rain', label: '窗边雨', hint: '柔和的室内雨声', emoji: '🪟' },
  { id: 'storm', label: '远雷雨', hint: '低沉雷声与阵雨', emoji: '⛈️' },
  { id: 'waves', label: '海浪', hint: '缓慢涨落的潮汐', emoji: '🌊' },
  { id: 'river', label: '溪流', hint: '清亮流动的水声', emoji: '💧' },
  { id: 'fire', label: '篝火', hint: '暖暖的火焰与爆裂声', emoji: '🔥' },
  { id: 'wind', label: '风声', hint: '起伏的低频山风', emoji: '🍃' },
  { id: 'forest', label: '树林', hint: '风过树梢与林间底噪', emoji: '🌲' },
  { id: 'birds', label: '鸟鸣', hint: '轻柔的间歇鸣叫', emoji: '🐦' },
  { id: 'night', label: '夏夜', hint: '虫鸣与夜间氛围', emoji: '🦗' },
  { id: 'cafe', label: '咖啡馆', hint: '温和的人声环境底噪', emoji: '☕' },
  { id: 'white', label: '白噪音', hint: '均匀宽频遮噪', emoji: '〰️' },
  { id: 'pink', label: '粉噪音', hint: '柔和低频宽频声', emoji: '🎧' },
  { id: 'brown', label: '棕噪音', hint: '深沉、放松的低频声', emoji: '🌙' },
]

interface NoiseNativeModule {
  startNoise(scenes: string, volume: number): void
  setNoiseScenes(scenes: string): void
  setNoiseVolume(volume: number): void
  setNoiseSleepTimer(minutes: number): void
  stopNoise(): void
}

export function useWhiteNoise() {
  const [scenes, setScenes] = useState<NoiseScene[]>([])
  const [volume, setVolume] = useState(45)
  const [playing, setPlaying] = useState(false)
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null)

  const toggleScene = useCallback((scene: NoiseScene) => {
    const native = NativeModules.FocusNotesWidget as NoiseNativeModule | undefined
    if (!native) throw new Error('白噪音播放需要 Android 原生音频服务。')
    const next = scenes.includes(scene) ? scenes.filter((item) => item !== scene) : [...scenes, scene]
    if (next.length > 4) throw new Error('最多同时混合 4 种环境音。')
    if (next.length === 0) {
      native.stopNoise()
      setScenes([])
      setPlaying(false)
      return
    }
    if (playing) native.setNoiseScenes(next.join(','))
    else {
      native.startNoise(next.join(','), volume)
      setPlaying(true)
    }
    setScenes(next)
  }, [playing, scenes, volume])

  const stop = useCallback(() => {
    const native = NativeModules.FocusNotesWidget as NoiseNativeModule | undefined
    native?.stopNoise()
    setScenes([])
    setPlaying(false)
    setSleepMinutes(null)
  }, [])

  const setSleepTimer = useCallback((minutes: number | null) => {
    const native = NativeModules.FocusNotesWidget as NoiseNativeModule | undefined
    if (!native) throw new Error('睡眠定时需要 Android 原生音频服务。')
    native.setNoiseSleepTimer(minutes ?? 0)
    setSleepMinutes(minutes)
  }, [])

  const adjustVolume = useCallback((amount: number) => {
    const next = Math.max(0, Math.min(100, volume + amount))
    setVolume(next)
    const native = NativeModules.FocusNotesWidget as NoiseNativeModule | undefined
    if (playing) native?.setNoiseVolume(next)
  }, [playing, volume])

  return { selectedScenes: scenes, volume, playing, sleepMinutes, scenes: NOISE_SCENES, toggleScene, stop, setSleepTimer, adjustVolume }
}
