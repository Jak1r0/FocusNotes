import { useMemo } from 'react'

function bevel(coordinate: number) {
  return Math.sign(coordinate) * Math.max(0, (Math.abs(coordinate) - .64) / .36) ** 2
}

function createLensMap() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return null

  const pixels = context.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const horizontal = (x + .5) / size * 2 - 1
      const vertical = (y + .5) / size * 2 - 1
      const index = (y * size + x) * 4
      // The neutral center leaves content stationary. The bevel samples inward near each edge.
      pixels.data[index] = 128 - 114 * bevel(horizontal)
      pixels.data[index + 1] = 128 - 114 * bevel(vertical)
      pixels.data[index + 2] = 128
      pixels.data[index + 3] = 255
    }
  }
  context.putImageData(pixels, 0, 0)
  return canvas.toDataURL()
}

export function LiquidGlassLens({ strength }: { strength: number }) {
  const lensMap = useMemo(createLensMap, [])
  if (!lensMap) return null

  return (
    <svg className="liquid-glass-definitions" width="0" height="0" aria-hidden="true">
      <filter id="focusnotes-liquid-lens" x="0" y="0" width="1" height="1"
        primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
        <feImage href={lensMap} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="bevel" />
        <feDisplacementMap in="SourceGraphic" in2="bevel" scale={.07 * strength / 100} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}
