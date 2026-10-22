import type { CSSProperties } from 'react'
import styles from './ui.module.css'

type Props = {
  name: string
  size?: number
  className?: string
  style?: CSSProperties
}

// Material Symbols ligature icon. Decorative: pair it with visible text or an aria-label.
function Icon({ name, size = 24, className, style }: Props) {
  return (
    <span aria-hidden className={`${styles.icon} ${className ?? ''}`} style={{ fontSize: size, ...style }}>
      {name}
    </span>
  )
}

export default Icon
