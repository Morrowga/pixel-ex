import { memo, useMemo } from 'react'
import { PALETTE } from './palette'
import { SIZE } from './grid'

/** Merge runs of the same colour into one rectangle, so a sprite is a few dozen shapes, not 256. */
function toRects(rows: string[]) {
  const out: { x: number; y: number; w: number; fill: string }[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < SIZE) {
      const ch = row[x]
      if (ch === '.' || !PALETTE[ch]) { x++; continue }
      let w = 1
      while (x + w < SIZE && row[x + w] === ch) w++
      out.push({ x, y, w, fill: PALETTE[ch] })
      x += w
    }
  })
  return out
}

/** One sprite frame, centred on (0,0), `px` pixels wide. Crisp edges, no blur. */
export const SpriteSvg = memo(function SpriteSvg({ rows, px, flip = false }: { rows: string[]; px: number; flip?: boolean }) {
  const rects = useMemo(() => toRects(rows), [rows])
  const k = px / SIZE
  return (
    <g transform={`scale(${flip ? -k : k} ${k}) translate(${-SIZE / 2} ${-SIZE / 2})`} shapeRendering="crispEdges">
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w + 0.02} height={1.02} fill={r.fill} />
      ))}
    </g>
  )
})
