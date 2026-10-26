import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { SPRITES } from '../src/sprites/library'
import { PALETTE } from '../src/sprites/palette'

/** Writes public/favicon.ico from the first frame of the runner sprite, at 16, 32 and 48 px. Usage: tsx scripts/make-favicon.ts */
const rows = SPRITES.runner.frames[0]

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }

function png(scale: number): Buffer {
  const n = 16 * scale
  const raw = Buffer.alloc((n * 4 + 1) * n)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const ch = rows[Math.floor(y / scale)][Math.floor(x / scale)]
      if (ch === '.') continue
      const hex = PALETTE[ch]
      const o = y * (n * 4 + 1) + 1 + x * 4
      raw[o] = parseInt(hex.slice(1, 3), 16); raw[o + 1] = parseInt(hex.slice(3, 5), 16); raw[o + 2] = parseInt(hex.slice(5, 7), 16); raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const images = [1, 2, 3].map((s) => ({ size: 16 * s, data: png(s) }))
const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4)
let offset = 6 + 16 * images.length
const entries = images.map((im) => {
  const e = Buffer.alloc(16)
  e[0] = im.size; e[1] = im.size; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(im.data.length, 8); e.writeUInt32LE(offset, 12)
  offset += im.data.length
  return e
})
mkdirSync('public', { recursive: true })
writeFileSync('public/favicon.ico', Buffer.concat([head, ...entries, ...images.map((i) => i.data)]))
console.log('wrote public/favicon.ico', images.map((i) => `${i.size}px`).join(', '))
