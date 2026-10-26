import { deflateSync } from 'node:zlib'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { SPRITES } from '../src/sprites/library'
import { PALETTE } from '../src/sprites/palette'

/** Writes a PNG contact sheet of every sprite frame, so the art can be looked at. Usage: tsx scripts/preview-sprites.ts out.png [dir of saved sprites] */
const out = process.argv[2] ?? 'sprites.png'
const SCALE = 8, COLS = 8, CELL = 16 * SCALE + 12
const extra = process.argv[3] ? Object.fromEntries(readdirSync(process.argv[3]).filter((f) => f.endsWith('.json')).map((f) => [`~${f.slice(0, -5)}`, JSON.parse(readFileSync(`${process.argv[3]}/${f}`, 'utf8'))])) : {}
const frames = Object.entries(process.argv[3] ? extra : SPRITES).flatMap(([name, s]) => s.frames.map((rows, i) => ({ name: `${name}${i}`, rows })))
const W = COLS * CELL, H = Math.ceil(frames.length / COLS) * CELL
const px = Buffer.alloc(W * H * 4, 245)
const set = (x: number, y: number, hex: string) => {
  const o = (y * W + x) * 4
  px[o] = parseInt(hex.slice(1, 3), 16); px[o + 1] = parseInt(hex.slice(3, 5), 16); px[o + 2] = parseInt(hex.slice(5, 7), 16); px[o + 3] = 255
}
frames.forEach((f, n) => {
  const ox = (n % COLS) * CELL + 6, oy = Math.floor(n / COLS) * CELL + 6
  f.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const hex = ch === '.' ? ((x + y) % 2 ? '#e8e8ee' : '#f6f6fa') : PALETTE[ch]
    for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) set(ox + x * SCALE + dx, oy + y * SCALE + dy, hex)
  }))
})
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6
const raw = Buffer.alloc((W * 4 + 1) * H)
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4) }
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
console.log(frames.map((f) => f.name).join(' '))
