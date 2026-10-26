import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

export const STAGE_HEIGHT = 320

/**
 * How wide the stage should be so it has the same shape as the free area.
 * Height is fixed, so on a wide window the stage grows wider and pictures can spread across the whole screen.
 */
export function stageWidth(w: number, h: number, minW = 640, maxW = 1400): number {
  if (!(w > 0) || !(h > 0)) return minW
  return Math.round(Math.min(maxW, Math.max(minW, (STAGE_HEIGHT * w) / h)))
}

/** Width and height of an element, kept up to date. */
export function useSize<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

interface Props {
  label: string
  minW?: number
  maxW?: number
  children: (width: number) => ReactNode
}

/** An SVG stage that fills its box exactly: same height always, as wide as the window needs. */
export function FitStage({ label, minW = 640, maxW = 1400, children }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const { w, h } = useSize(box)
  const W = stageWidth(w, h, minW, maxW)
  return (
    <div ref={box} className="fillbox">
      <svg className="stage" viewBox={`0 0 ${W} ${STAGE_HEIGHT}`} role="img" aria-label={label}>
        {children(W)}
      </svg>
    </div>
  )
}
