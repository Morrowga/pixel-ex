import { motion } from 'framer-motion'
import type { Item } from '../engine/types'
import { useSprite } from '../sprites/SpriteContext'
import { SpriteSvg } from '../sprites/SpriteSvg'

/**
 * One object: just its pixel sprite. Its group colour is a soft glow that follows the sprite's own shape,
 * so you can still see where each number came from. Rolls in slowly, then moves to its spot.
 */
export function Token({ item, index, size }: { item: Item; index: number; size: number }) {
  const { x, y, color, sprite, state, piece } = item
  const { data } = useSprite(sprite)
  const glow = state === 'glow'
  const filter = glow
    ? 'drop-shadow(0 0 5px #facc15) drop-shadow(0 0 10px #facc15)'
    : `drop-shadow(0 0 3px ${color}) drop-shadow(0 0 1px ${color})`
  return (
    <motion.g
      initial={{ x: -50, y, opacity: 0, rotate: -270 }}
      animate={{ x, y, opacity: state === 'dim' ? 0.3 : 1, rotate: 0, scale: glow ? 1.15 : 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.5 } }}
      transition={{ type: 'spring', stiffness: 28, damping: 15, mass: 1.2, delay: Math.min(index, 12) * 0.18 }}
    >
      <g style={{ filter }}>
        <SpriteSvg rows={data.frames[0]} px={size * (piece ? 1.7 : 2)} />
      </g>
    </motion.g>
  )
}
