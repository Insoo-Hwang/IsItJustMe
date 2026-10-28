import { useEffect, useState, type ReactNode } from 'react'
import Icon from '../components/Icon.tsx'
import { SPEAKER_NAMES, type Line } from '../data/ending.ts'
import styles from './EndingPage.module.css'

type Props = {
  lines: Line[]
  // shown under the last line instead of tapping on
  choices?: ReactNode
  onDone?: () => void
}

const TYPE_MS = 45
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Visual novel style: one line at a time, typed out. Tap to finish the line, tap again for the next.
function EndingDialogue({ lines, choices, onDone }: Props) {
  const [index, setIndex] = useState(0)
  const [chars, setChars] = useState(0)
  const line = lines[index]
  const last = index === lines.length - 1
  const typing = !reducedMotion && chars < line.text.length

  useEffect(() => {
    if (!typing) return
    const timer = setTimeout(() => setChars((c) => c + 1), TYPE_MS)
    return () => clearTimeout(timer)
  }, [typing, chars])

  const advance = () => {
    if (typing) setChars(line.text.length)
    else if (!last) {
      setIndex(index + 1)
      setChars(0)
    } else if (!choices) onDone?.()
  }

  const waiting = !typing && !(last && choices)
  const system = line.speaker === 'system'
  return (
    <div className={styles.dialogue}>
      <button type="button" className={styles.tap} onClick={advance}>
        <span className={styles.stage}>
          {system ? (
            <span className={styles.mystery} aria-hidden>
              ?
            </span>
          ) : (
            <>
              <span className={`${styles.actor} ${line.speaker === 'past' ? styles.speaking : ''}`} aria-hidden>
                <Icon name="face" size={56} />
              </span>
              <span className={`${styles.actor} ${styles.now} ${line.speaker === 'now' ? styles.speaking : ''}`} aria-hidden>
                <Icon name="person" size={56} />
              </span>
            </>
          )}
        </span>

        <span className={`${styles.box} ${system ? styles.systemBox : ''}`}>
          {!system && (
            <span className={`${styles.name} ${line.speaker === 'past' ? styles.namePast : styles.nameNow}`}>
              {SPEAKER_NAMES[line.speaker]}
            </span>
          )}
          <span className={styles.text} aria-live="polite">
            {typing ? line.text.slice(0, chars) : line.text}
          </span>
          {waiting && <Icon name="keyboard_arrow_down" size={22} className={styles.next} />}
        </span>
      </button>

      {last && !typing && choices}
    </div>
  )
}

export default EndingDialogue
