import type { PointerEvent } from 'react'

export function updateGlassPointer(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse') return
  const control = event.currentTarget
  if (!control.closest('.effect-liquid')) return

  const bounds = control.getBoundingClientRect()
  control.style.setProperty('--glass-pointer-x', `${event.clientX - bounds.left}px`)
  control.style.setProperty('--glass-pointer-y', `${event.clientY - bounds.top}px`)
}
