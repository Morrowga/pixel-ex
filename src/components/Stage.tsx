import { AnimatePresence, motion } from 'framer-motion'
import type { Scene } from '../engine/types'
import { STAGE } from '../engine/simulate'
import { FitStage } from './FitStage'
import { Token } from './Token'

/** Counting objects. On a wide window the extra width is shared out, so groups use the whole screen. */
export function Stage({ scene }: { scene: Scene }) {
  return (
    <FitStage label={`${scene.items.length} objects on the stage`} minW={STAGE.width}>
      {(W) => {
        const f = W / STAGE.width // 1 or more: only ever spreads things out, never squeezes them
        return (
          <>
            <AnimatePresence>
              {scene.baskets.map((b) => (
                <motion.rect
                  key={b.id}
                  className="basket"
                  rx={14}
                  initial={{ opacity: 0, x: b.x * f, y: b.y, width: b.w * f, height: b.h }}
                  animate={{ opacity: 1, x: b.x * f, y: b.y, width: b.w * f, height: b.h }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                />
              ))}
            </AnimatePresence>
            <AnimatePresence>
              {scene.items.map((item, i) => (
                <Token key={item.id} item={{ ...item, x: item.x * f }} index={i} size={scene.size} />
              ))}
            </AnimatePresence>
          </>
        )
      }}
    </FitStage>
  )
}
