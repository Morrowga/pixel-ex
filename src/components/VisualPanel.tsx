import { AnimatePresence, motion } from 'framer-motion'
import type { Visual } from '../engine/types'
import { useSprite } from '../sprites/SpriteContext'
import { SpriteSvg } from '../sprites/SpriteSvg'
import { SceneView } from './SceneView'
import { FitStage } from './FitStage'

function Balance({ boxes, leftBlocks, rightBlocks, W }: { boxes: number; leftBlocks: number; rightBlocks: number; W: number }) {
  const box = useSprite('box').data.frames[0]
  const block = useSprite('square').data.frames[0]
  // Items sit in rows of up to 5, stacked upwards from the pan.
  const pile = (n: number, cx: number, px: number, sprite: string[], startRow = 0) =>
    Array.from({ length: n }, (_, i) => {
      const r = startRow + Math.floor(i / 5)
      const inRow = Math.min(5, n - Math.floor(i / 5) * 5)
      return (
        <motion.g key={`${cx}-${px}-${i}`} initial={{ opacity: 0, scale: 0.2 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.2 }} transition={{ duration: 0.9, delay: i * 0.12 }} style={{ x: cx + ((i % 5) - (inRow - 1) / 2) * (px + 4), y: 178 - px / 2 - r * (px + 4) }}>
          <SpriteSvg rows={sprite} px={px} />
        </motion.g>
      )
    })
  const leftRows = Math.ceil(boxes / 5)
  return (
    <g transform={`translate(${(W - 640) / 2} 0)`}>
      <polygon points="320,200 290,290 350,290" fill="currentColor" opacity={0.35} />
      <rect x={270} y={288} width={100} height={8} rx={3} fill="currentColor" opacity={0.35} />
      <rect x={90} y={186} width={460} height={8} rx={4} fill="currentColor" opacity={0.75} />
      <rect x={90} y={178} width={190} height={8} rx={3} fill="currentColor" opacity={0.5} />
      <rect x={360} y={178} width={190} height={8} rx={3} fill="currentColor" opacity={0.5} />
      <AnimatePresence>{pile(boxes, 185, 48, box)}</AnimatePresence>
      <AnimatePresence>{pile(leftBlocks, 185, 30, block, leftRows)}</AnimatePresence>
      <AnimatePresence>{pile(rightBlocks, 455, 30, block)}</AnimatePresence>
      {boxes > 0 && <text x={185} y={314} textAnchor="middle" fontSize={16} fontWeight={700} fill="currentColor">{boxes > 1 ? `${boxes} hidden boxes` : 'hidden box'}</text>}
    </g>
  )
}

/** The pictures that are not the counting stage. All drawn from data, never by the AI. */
export function VisualPanel({ visual, previous = null }: { visual: Visual; previous?: Visual | null }) {
  switch (visual.kind) {
    case 'scene':
      return <SceneView visual={visual} previous={previous?.kind === 'scene' ? previous : null} />
    case 'graph': {
      const ys = visual.samples.map(([, y]) => y)
      const [x0, x1] = [visual.xMin, visual.xMax]
      const [y0, y1] = [Math.min(...ys), Math.max(...ys)]
      return (
        <FitStage label={`Graph of y = ${visual.expr}`}>
          {(W) => {
            const px = (x: number) => 40 + ((x - x0) / (x1 - x0)) * (W - 80)
            const py = (y: number) => 290 - ((y - y0) / (y1 - y0 || 1)) * 250
            const zeroX = x0 <= 0 && x1 >= 0 ? px(0) : null
            const zeroY = y0 <= 0 && y1 >= 0 ? py(0) : null
            return (
              <>
                {zeroY !== null && <line x1={24} x2={W - 24} y1={zeroY} y2={zeroY} stroke="currentColor" opacity={0.35} strokeWidth={2} />}
                {zeroX !== null && <line y1={24} y2={300} x1={zeroX} x2={zeroX} stroke="currentColor" opacity={0.35} strokeWidth={2} />}
                <motion.polyline fill="none" stroke="var(--brand)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" points={visual.samples.map(([x, y]) => `${px(x)},${py(y)}`).join(' ')} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 3.2, ease: 'easeInOut' }} />
                <text x={20} y={26} fill="currentColor" fontSize={16} fontWeight={700}>y = {visual.expr}</text>
              </>
            )
          }}
        </FitStage>
      )
    }
    case 'numberline':
      return (
        <FitStage label="Number line">
          {(W) => {
            const px = (x: number) => 60 + ((x - visual.min) / (visual.max - visual.min)) * (W - 120)
            return (
              <>
                <motion.line x1={40} x2={W - 40} y1={170} y2={170} stroke="currentColor" strokeWidth={4} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: 'easeInOut' }} />
                {visual.marks.map((m, i) => (
                  <motion.g key={m.at + m.label} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 90, damping: 12, delay: 1.2 + i * 0.7 }} style={{ transformOrigin: `${px(m.at)}px 170px` }}>
                    <circle cx={px(m.at)} cy={170} r={9} fill="var(--brand)" />
                    <text x={px(m.at)} y={208} textAnchor="middle" fill="currentColor" fontSize={16} fontWeight={700}>{m.label}</text>
                  </motion.g>
                ))}
              </>
            )
          }}
        </FitStage>
      )
    case 'balance':
      return (
        <FitStage label="A balance scale">
          {(W) => <Balance boxes={visual.boxes} leftBlocks={visual.leftBlocks} rightBlocks={visual.rightBlocks} W={W} />}
        </FitStage>
      )
  }
}
