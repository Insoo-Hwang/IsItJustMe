import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './BottomSheet.module.css'

type Props = {
  label: string
  onClose: () => void
  children: ReactNode
}

function BottomSheet({ label, onClose, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Focus once on open; re-renders must not pull focus back to the panel.
  useEffect(() => {
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div ref={panelRef} className={styles.sheet} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        <div className={styles.handle} />
        {children}
      </div>
    </>,
    document.body,
  )
}

export default BottomSheet
