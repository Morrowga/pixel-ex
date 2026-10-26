import type { ReactNode } from 'react'

const Svg = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

export const IconPrev = () => <Svg><path d="M15 5l-7 7 7 7" /></Svg>
export const IconNext = () => <Svg><path d="M9 5l7 7-7 7" /></Svg>
export const IconPlay = () => <Svg><path d="M8 5v14l11-7z" fill="currentColor" /></Svg>
export const IconPause = () => <Svg><path d="M8 5v14M16 5v14" /></Svg>
export const IconReplay = () => <Svg><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v5h5" /></Svg>
export const IconSend = () => <Svg><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
export const IconBack = () => <Svg size={14}><path d="M15 5l-7 7 7 7" /></Svg>
