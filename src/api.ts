import type { LessonResponse, LessonStage } from './engine/types'
import type { Lang } from './i18n/lang'

export type LessonResult = LessonResponse | { error: string }

/** Asks for a lesson in `lang` and reports real progress (reading the question, drawing a sprite...) as it happens. */
export async function requestLesson(question: string, lang: Lang, onStage: (s: LessonStage) => void): Promise<LessonResult> {
  const res = await fetch('/api/lesson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
    body: JSON.stringify({ question, lang }),
  })
  if (!res.body || !res.headers.get('content-type')?.includes('ndjson')) return (await res.json()) as LessonResult

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: LessonResult = { error: 'The connection closed before the lesson was ready.' }
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      const ev = JSON.parse(line)
      if (ev.type === 'stage') onStage({ stage: ev.stage, detail: ev.detail })
      else if (ev.type === 'result') result = ev.result
      else if (ev.type === 'error') result = { error: ev.error }
    }
  }
  return result
}
