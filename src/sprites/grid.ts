import { PALETTE } from './palette'

export const SIZE = 16

/** Checks a sprite frame: 16 rows of 16 palette characters, not mostly empty. Returns a problem or null. */
export function validateGrid(rows: unknown): string | null {
  if (!Array.isArray(rows) || rows.length !== SIZE) return `needs exactly ${SIZE} rows`
  let filled = 0
  for (const [i, row] of rows.entries()) {
    if (typeof row !== 'string' || row.length !== SIZE) return `row ${i} must be exactly ${SIZE} characters`
    for (const ch of row) {
      if (ch === '.') continue
      if (!(ch in PALETTE)) return `row ${i} uses "${ch}", which is not in the palette`
      filled++
    }
  }
  if (filled < 24) return 'the picture is almost empty'
  if (filled > SIZE * SIZE - 8) return 'the picture fills the whole square; leave a transparent border'
  return null
}

/** Drawn when a sprite name is unknown and nothing could be made for it. */
export const PLACEHOLDER: string[] = [
  '................',
  '..KKKKKKKKKKKK..',
  '..KGGGGGGGGGGK..',
  '..KGGGKKKKGGGK..',
  '..KGGKGGGGKGGK..',
  '..KGGGGGGKGGGK..',
  '..KGGGGGKGGGGK..',
  '..KGGGGKGGGGGK..',
  '..KGGGGKGGGGGK..',
  '..KGGGGGGGGGGK..',
  '..KGGGGKGGGGGK..',
  '..KGGGGGGGGGGK..',
  '..KKKKKKKKKKKK..',
  '................',
  '................',
  '................',
]
