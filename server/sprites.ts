import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { validateGrid } from '../src/sprites/grid'
import { SPRITES, type SpriteData } from '../src/sprites/library'
import { slug } from '../src/sprites/names'

export interface SpriteDeps {
  /** Folder where AI-drawn sprites are saved, so the next person gets the same one for free. */
  dir: string
  /** Other folders to look in first (read-only is fine). */
  readDirs?: string[]
  /** Draws a new 16x16 sprite for a subject, or null if it could not. */
  generate: (subject: string) => Promise<string[] | null>
  log: (msg: string) => void
  /** Called when a sprite has to be drawn by the AI (the slow path). */
  onDraw?: (name: string) => void
}

export interface Resolved {
  /** Sprites the library does not have, ready to send with the lesson. */
  custom: Record<string, SpriteData>
  /** Names that could not be made at all; the browser draws a labelled placeholder. */
  missing: string[]
}

/**
 * Makes sure every sprite name in a lesson can be drawn.
 * 1. library (nothing to do)  2. saved folder  3. ask the AI, check it, save it  4. placeholder
 */
export async function resolveSprites(names: string[], deps: SpriteDeps): Promise<Resolved> {
  const custom: Record<string, SpriteData> = {}
  const missing: string[] = []
  const wanted = [...new Set(names.map(slug).filter(Boolean))].filter((n) => !(n in SPRITES))

  await Promise.all(
    wanted.map(async (name) => {
      const file = join(deps.dir, `${name}.json`)

      for (const dir of [deps.dir, ...(deps.readDirs ?? [])]) {
        try {
          const saved = JSON.parse(await readFile(join(dir, `${name}.json`), 'utf8')) as SpriteData
          if (saved.frames?.every((f) => validateGrid(f) === null)) {
            custom[name] = saved
            deps.log(`  ▫ sprite "${name}": from saved folder`)
            return
          }
        } catch {
          /* not in this folder */
        }
      }

      deps.onDraw?.(name.replace(/_/g, ' '))
      const rows = await deps.generate(name.replace(/_/g, ' '))
      if (rows && validateGrid(rows) === null) {
        const data: SpriteData = { frames: [rows] }
        custom[name] = data
        try {
          await mkdir(deps.dir, { recursive: true })
          await writeFile(file, JSON.stringify(data, null, 1))
          deps.log(`  ▫ sprite "${name}": drawn by the AI and saved`)
        } catch {
          // A read-only disk: the lesson still carries the sprite, it just is not kept for next time.
          deps.log(`  ▫ sprite "${name}": drawn by the AI (could not be saved on this server)`)
        }
        return
      }

      missing.push(name)
      deps.log(`  ▫ sprite "${name}": MISSING, showing a placeholder (add it to the library)`)
    }),
  )
  return { custom, missing }
}
