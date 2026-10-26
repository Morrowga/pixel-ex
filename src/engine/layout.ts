export const STAGE = { width: 640, height: 320 }
export const BALL_R = 24

/** A horizontal row of `count` positions starting at the left edge. */
export function rowLayout(count: number, y: number, startX = 70, gap = 58) {
  return Array.from({ length: count }, (_, i) => ({ x: startX + i * gap, y }))
}

/** A centred pile, filled bottom row first, four per row. */
export function pileLayout(count: number, cx: number, baseY: number, perRow = 4, gap = 54) {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow)
    const inRow = Math.min(perRow, count - row * perRow)
    const col = i % perRow
    out.push({
      x: cx + (col - (inRow - 1) / 2) * gap,
      y: baseY - row * (gap - 4),
    })
  }
  return out
}
