import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { log } from './log'

/**
 * A sealed token: the server hands it to the browser and the browser gives it back. It is encrypted and signed
 * (AES-256-GCM), so the browser cannot read the hidden answer inside it or change it. Because the token carries
 * everything the server needs, the server remembers nothing between requests, which is what hosting on
 * serverless platforms like Vercel needs.
 */
let warned = false
function key(): Buffer {
  const secret = process.env.LESSON_SECRET ?? process.env.OPENAI_API_KEY
  if (!secret) throw new Error('Set LESSON_SECRET (any long random text) in the environment.')
  if (!process.env.LESSON_SECRET && !warned) {
    warned = true
    log('  ⚠ LESSON_SECRET is not set; sealing answers with a key derived from OPENAI_API_KEY. Set LESSON_SECRET in production.')
  }
  return createHash('sha256').update(`question-explainer:${secret}`).digest()
}

export function seal(payload: unknown, ttlMs: number): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify({ exp: Date.now() + ttlMs, p: payload }), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url')
}

/** The payload, or null when the token is not ours, was changed, or has expired. */
export function unseal<T>(token: string): T | null {
  try {
    const raw = Buffer.from(token, 'base64url')
    if (raw.length < 29) return null
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
    const { exp, p } = JSON.parse(json) as { exp: number; p: T }
    return Date.now() < exp ? p : null
  } catch {
    return null
  }
}
