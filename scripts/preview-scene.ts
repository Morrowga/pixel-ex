import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { layoutScene } from '../src/engine/sceneLayout'
import { pillSize } from '../src/engine/declutter'
import type { SceneActor, SceneArrow } from '../src/engine/types'
import { SPRITES } from '../src/sprites/library'
import { PALETTE } from '../src/sprites/palette'

/**
 * Draws a scene exactly as the app lays it out. Text is shown as boxes (labels yellow, speech white,
 * arrow labels dark with a white rim). Usage: tsx scripts/preview-scene.ts out.png [windowW windowH]
 */
const out = process.argv[2] ?? 'scene.png'
const [winW, winH] = [Number(process.argv[3] ?? 2000), Number(process.argv[4] ?? 800)]
const WL = Math.round(Math.min(1400, Math.max(560, (320 * winW) / winH)))
const HL = 320
const a = (id: string, sprite: string, x: number, y: number, o: Partial<SceneActor> = {}): SceneActor => ({ id, sprite, x, y, motion: 'none', flip: false, label: '', say: '', ...o })
const actors: SceneActor[] = [
  a('gpu', 'chip', 8, 50, { label: 'GPU', say: 'many jobs' }),
  a('p1', 'square', 45, 22, { label: 'picture part' }),
  a('p2', 'square', 38, 70, { label: 'picture part' }),
  a('p3', 'square', 60, 85, { label: 'picture part' }),
  a('screen', 'computer', 92, 50, { label: 'screen' }),
]
const arrows: SceneArrow[] = [
  { from: 'p1', to: 'gpu', label: 'small job' }, { from: 'p2', to: 'gpu', label: 'small job' },
  { from: 'p3', to: 'gpu', label: 'small job' }, { from: 'gpu', to: 'screen', label: 'shows result' },
]
const L = layoutScene(actors, arrows, WL, HL)
const Z = 1000 / WL
const PW = 1020, PH = Math.round(HL * Z) + 20
const px = Buffer.alloc(PW * PH * 4)
for (let i = 0; i < PW * PH; i++) { px[i * 4] = 25; px[i * 4 + 1] = 28; px[i * 4 + 2] = 58; px[i * 4 + 3] = 255 }
const set = (x: number, y: number, hex: string) => {
  x = Math.round(x); y = Math.round(y)
  if (x < 0 || y < 0 || x >= PW || y >= PH) return
  const o = (y * PW + x) * 4
  px[o] = parseInt(hex.slice(1, 3), 16); px[o + 1] = parseInt(hex.slice(3, 5), 16); px[o + 2] = parseInt(hex.slice(5, 7), 16)
}
const rect = (x: number, y: number, w: number, h: number, hex: string, fill = false) => {
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) if (fill || i < 2 || j < 2 || i >= w - 2 || j >= h - 2) set(x + i, y + j, hex)
}
const dot = (x: number, y: number, r: number, hex: string) => { for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) if (i * i + j * j <= r * r) set(x + i, y + j, hex) }
const X = (v: number) => 10 + v * Z, Y = (v: number) => 10 + v * Z

rect(10, 10, WL * Z, HL * Z, '#2a2f5a')
// lines
L.routes.forEach((r) => {
  for (let i = 0; i <= 120; i++) { const p = r.at(i / 120); dot(X(p.x), Y(p.y), 2, '#a4aeff') }
  const hm = r.head.match(/-?\d+(\.\d+)?/g)!.map(Number)
  for (let i = 0; i <= 14; i++) { dot(X(hm[0] + (hm[2] - hm[0]) * i / 14), Y(hm[1] + (hm[3] - hm[1]) * i / 14), 2, '#a4aeff'); dot(X(hm[4] + (hm[2] - hm[4]) * i / 14), Y(hm[5] + (hm[3] - hm[5]) * i / 14), 2, '#a4aeff') }
})
// sprites and their text
for (const ac of L.actors) {
  const p = L.placed[ac.id], k = (L.px * Z) / 16
  SPRITES[ac.sprite].frames[0].forEach((row, yy) => [...row].forEach((ch, xx) => {
    if (ch === '.') return
    for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) set(X(p.x) - (L.px * Z) / 2 + xx * k + dx, Y(p.y) - (L.px * Z) / 2 + yy * k + dy, PALETTE[ch])
  }))
  if (ac.label) rect(X(p.x) - ((ac.label.length * 9 + 12) * Z) / 2, Y(p.y) + (L.px * Z) / 2 + 4, (ac.label.length * 9 + 12) * Z, 22 * Z, '#ffd166', true)
  if (ac.say) rect(X(p.x) - ((ac.say.length * 8.4 + 24) * Z) / 2, Y(p.y) - (L.px * Z) / 2 - 46 * Z, (ac.say.length * 8.4 + 24) * Z, 32 * Z, '#ffffff', true)
}
// arrow labels last, on top of everything
L.pills.forEach((pl, i) => {
  if (!pl) return
  const { w, h } = pillSize(L.arrows[i].label)
  rect(X(pl.cx - w / 2) - 2, Y(pl.cy - h / 2) - 2, w * Z + 4, h * Z + 4, '#ffffff', true)
  rect(X(pl.cx - w / 2), Y(pl.cy - h / 2), w * Z, h * Z, '#1a1e3a', true)
})

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(PW, 0); ihdr.writeUInt32BE(PH, 4); ihdr[8] = 8; ihdr[9] = 6
const raw = Buffer.alloc((PW * 4 + 1) * PH)
for (let y = 0; y < PH; y++) { raw[y * (PW * 4 + 1)] = 0; px.copy(raw, y * (PW * 4 + 1) + 1, y * PW * 4, (y + 1) * PW * 4) }
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
