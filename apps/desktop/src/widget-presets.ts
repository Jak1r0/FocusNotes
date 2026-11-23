import type { WidgetPreferences } from '@focusnotes/core'
import type { WidgetDisplayMode } from './desktop'
import type { MotionMode } from './motion'

export interface WidgetPreset {
  id: string
  name: string
  displayMode: WidgetDisplayMode
  motion: MotionMode
  widget: WidgetPreferences
  savedAt: string
}

const STORAGE_KEY = 'focusnotes.widgetPresets'
const MAX_PRESETS = 8

function isDisplayMode(value: unknown): value is WidgetDisplayMode {
  return value === 'floating' || value === 'normal' || value === 'desktop'
}

function isMotion(value: unknown): value is MotionMode {
  return value === 'full' || value === 'light' || value === 'off'
}

function isPreset(value: unknown): value is WidgetPreset {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.name === 'string' && isDisplayMode(record.displayMode)
    && isMotion(record.motion) && Boolean(record.widget) && typeof record.widget === 'object'
}

export function loadWidgetPresets(): WidgetPreset[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter(isPreset).slice(0, MAX_PRESETS) : []
  } catch {
    return []
  }
}

export function persistWidgetPresets(presets: WidgetPreset[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.slice(0, MAX_PRESETS)))
  } catch {
    // 忽略存储配额错误，预设只是便捷功能。
  }
}

export function createWidgetPreset(
  name: string,
  displayMode: WidgetDisplayMode,
  motion: MotionMode,
  widget: WidgetPreferences,
): WidgetPreset {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    name: name.trim().slice(0, 24) || '未命名布局',
    displayMode,
    motion,
    widget: { ...widget },
    savedAt: new Date().toISOString(),
  }
}