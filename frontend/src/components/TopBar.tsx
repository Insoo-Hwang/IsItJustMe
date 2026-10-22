import type { ReactNode } from 'react'
import Icon from './Icon.tsx'
import styles from './ui.module.css'

type Action = { icon: string; label: string; onClick: () => void; muted?: boolean }

type Props = {
  title?: ReactNode
  left?: Action
  right?: Action
}

function ActionButton({ icon, label, onClick, muted }: Action) {
  return (
    <button type="button" className={styles.iconButton} onClick={onClick} aria-label={label}>
      <Icon name={icon} size={muted ? 24 : 26} style={muted ? { color: 'var(--mute)' } : undefined} />
    </button>
  )
}

function TopBar({ title, left, right }: Props) {
  return (
    <header className={styles.topBar}>
      {left ? <ActionButton {...left} /> : <span className={styles.iconButtonPlaceholder} />}
      <div className={styles.topBarTitle}>{title}</div>
      {right ? <ActionButton {...right} /> : <span className={styles.iconButtonPlaceholder} />}
    </header>
  )
}

export default TopBar
