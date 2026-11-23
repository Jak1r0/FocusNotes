import type { CSSProperties } from 'react'
import './glassBackdrop.css'

export type GlassBackdropMode = 'system' | 'image'

export function GlassBackdrop({ blur, mode = 'system', image = null }: { blur: number; mode?: GlassBackdropMode; image?: string | null }) {
  const system = mode === 'system' || !image
  return <div aria-hidden="true" className={`glass-backdrop${system ? ' system' : ''}`} style={{
    '--glass-blur': `${blur}px`,
    backgroundImage: system ? undefined : `url("${image}")`,
  } as CSSProperties} />
}