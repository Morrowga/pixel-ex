import { createContext, useContext } from 'react'
import { SPRITES, type SpriteData } from './library'
import { PLACEHOLDER } from './grid'

/** Sprites made for the current lesson because the library did not have them. */
export const CustomSprites = createContext<Record<string, SpriteData>>({})

/** Library first, then lesson-made, then a plain placeholder so nothing ever breaks. */
export function useSprite(name: string): { data: SpriteData; known: boolean } {
  const custom = useContext(CustomSprites)
  const data = SPRITES[name] ?? custom[name]
  return data ? { data, known: true } : { data: { frames: [PLACEHOLDER] }, known: false }
}
