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

/**
 * Fixes a drawing that is only slightly the wrong size, so it does not have to be redrawn (a redraw costs ~20 s).
 * Rows that are 1-2 characters short or long are padded or trimmed at the empty edges; the picture itself stays.
 * Returns the fixed rows, or null when it is too far off to trust.
 */
export function repairGrid(rows: unknown): string[] | null {
  if (!Array.isArray(rows) || rows.some((r) => typeof r !== 'string')) return null
  if (rows.length < SIZE - 2 || rows.length > SIZE + 2) return null
  const fixRow = (raw: string): string | null => {
    // letters in the wrong case, and anything outside the palette, become transparent
    let row = [...raw].map((c) => (c in PALETTE || c === '.' ? c : c.toUpperCase() in PALETTE ? c.toUpperCase() : '.')).join('')
    if (Math.abs(row.length - SIZE) > 2) return null
    while (row.length > SIZE) row = row.startsWith('.') ? row.slice(1) : row.endsWith('.') ? row.slice(0, -1) : row.slice(0, SIZE)
    while (row.length < SIZE) row = row.length % 2 ? row + '.' : '.' + row
    return row
  }
  const fixed = rows.map(fixRow)
  if (fixed.some((r) => r === null)) return null
  let out = fixed as string[]
  const blank = '.'.repeat(SIZE)
  while (out.length > SIZE) out = out[out.length - 1] === blank ? out.slice(0, -1) : out[0] === blank ? out.slice(1) : out.slice(0, SIZE)
  while (out.length < SIZE) out = out.length % 2 ? [...out, blank] : [blank, ...out]
  return validateGrid(out) ? null : out
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
