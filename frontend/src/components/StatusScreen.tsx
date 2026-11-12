import type { ReactNode } from 'react'
import Icon from './Icon.tsx'
import ui from './ui.module.css'
import styles from './StatusScreen.module.css'

type Action = { label: string; onClick: () => void; icon?: string }

type Props = {
  icon: string
  // a short code above the title, such as 404
  code?: string
  title: string
  text: ReactNode
  primary?: Action
  secondary?: Action
  // alert for failures the visitor should notice, status for waiting states
  role?: 'alert' | 'status'
}

// One screen for every dead end: missing pages, failures, being offline, maintenance.
// It needs no router, so it also works before the app has started.
function StatusScreen({ icon, code, title, text, primary, secondary, role = 'alert' }: Props) {
  return (
    <div className={styles.screen} role={role}>
      <div className={styles.body}>
        <span className={styles.mark} aria-hidden>
          <Icon name={icon} size={36} />
        </span>
        {code && <div className={styles.code}>{code}</div>}
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
      </div>
      {(primary || secondary) && (
        <div className={styles.actions}>
          {primary && (
            <button type="button" className={`${ui.primary} ${ui.large}`} onClick={primary.onClick}>
              {primary.icon && <Icon name={primary.icon} size={20} />}
              {primary.label}
            </button>
          )}
          {secondary && (
            <button type="button" className={styles.secondary} onClick={secondary.onClick}>
              {secondary.icon && <Icon name={secondary.icon} size={20} />}
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default StatusScreen
