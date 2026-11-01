import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { NAME_MAX_LENGTH } from '../lib/room.ts'
import { getTestState, setLastName } from '../store/testStore.ts'
import styles from './NameSheet.module.css'
import ui from './ui.module.css'

type Props = {
  title: string
  description: ReactNode
  confirmLabel: string
  busy?: boolean
  onSubmit: (name: string) => void
  onClose: () => void
}

// Bottom sheet asking for a display name. Remembers the last one on this device.
function NameSheet({ title, description, confirmLabel, busy, onSubmit, onClose }: Props) {
  const [name, setName] = useState(() => getTestState().lastName)
  const trimmed = name.trim()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!trimmed || busy) return
    setLastName(trimmed)
    onSubmit(trimmed)
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <form
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-sheet-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2 id="name-sheet-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.description}>{description}</p>
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX_LENGTH}
          placeholder="이름 또는 별명"
          aria-label="이름"
          autoFocus
        />
        <div className={styles.count}>
          {trimmed.length}/{NAME_MAX_LENGTH}
        </div>
        <div className={styles.actions}>
          <button type="button" className={ui.secondary} onClick={onClose}>
            취소
          </button>
          <button type="submit" className={ui.primary} disabled={!trimmed || busy}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

export default NameSheet
