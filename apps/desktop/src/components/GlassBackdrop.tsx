import { useEffect, useState, type CSSProperties } from 'react'
import './glassBackdrop.css'

export type GlassBackdropMode = 'system' | 'image' | 'wallpaper'

export function GlassBackdrop({ blur, mode = 'system', image = null, artwork = null }: { blur: number; mode?: GlassBackdropMode; image?: string | null; artwork?: string | null }) {
  const [wallpaper, setWallpaper] = useState<string | null>(null)
  useEffect(() => {
    if (mode !== 'wallpaper') return
    let alive = true
    const update = () => {
      void window.focusDesktop?.glassWallpaper?.().then((image) => {
        if (alive) setWallpaper(image)
      }).catch(() => undefined)
    }
    update()
    window.addEventListener('focus', update)
    return () => {
      alive = false
      window.removeEventListener('focus', update)
    }
  }, [mode])
  const system = !artwork && (mode === 'system' || (mode === 'image' && !image))
  const backgroundImage = mode === 'wallpaper' ? wallpaper : mode === 'image' ? image : null
  return <div aria-hidden="true" className={`glass-backdrop${system ? ' system' : ''}`} style={{
    '--glass-blur': `${blur}px`,
    '--artwork-image': artwork ? `url("${new URL(artwork, document.baseURI).href}")` : undefined,
    backgroundImage: !artwork && backgroundImage ? `url("${backgroundImage}")` : undefined,
  } as CSSProperties} />
}