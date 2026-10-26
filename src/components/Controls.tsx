import { IconNext, IconPause, IconPlay, IconPrev, IconReplay } from './icons'
import { useI18n } from '../i18n/I18n'

interface Props {
  index: number
  total: number
  playing: boolean
  atStart: boolean
  atEnd: boolean
  onBack: () => void
  onNext: () => void
  onToggle: () => void
}

/** Small on purpose: the picture and the words are what matter. */
export function Controls({ index, total, playing, atStart, atEnd, onBack, onNext, onToggle }: Props) {
  const { t } = useI18n()
  const label = atEnd ? t('controls.replay') : playing ? t('controls.pause') : t('controls.play')
  return (
    <div className="controls" role="group" aria-label={t('controls.group')}>
      <button onClick={onBack} disabled={atStart} aria-label={t('controls.back')} title={t('controls.back')}>
        <IconPrev />
      </button>
      <button onClick={onToggle} className="main" aria-label={label} title={label}>
        {atEnd ? <IconReplay /> : playing ? <IconPause /> : <IconPlay />}
      </button>
      <button onClick={onNext} disabled={atEnd} aria-label={t('controls.next')} title={t('controls.next')}>
        <IconNext />
      </button>
      <div className="ticks" aria-label={t('controls.step', { n: index + 1, total })}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i === index ? 'tick on' : i < index ? 'tick done' : 'tick'} />
        ))}
      </div>
    </div>
  )
}
