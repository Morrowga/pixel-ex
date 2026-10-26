import type { CSSProperties } from 'react'

/** The line spoken to the learner. `**bold**` marks the key phrase, tinted with the step's accent. */
export function Caption({ text, accent }: { text: string; accent?: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return (
    <p className="caption" style={accent ? ({ '--accent': accent } as CSSProperties) : undefined} aria-live="polite">
      {parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>))}
    </p>
  )
}
