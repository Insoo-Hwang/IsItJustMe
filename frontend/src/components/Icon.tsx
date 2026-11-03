import type { CSSProperties } from 'react'
import styles from './ui.module.css'

type Props = {
  name: string
  size?: number
  // solid glyph instead of the outline one
  filled?: boolean
  className?: string
  style?: CSSProperties
}

// Material Symbols ligature icon. Decorative: pair it with visible text or an aria-label.
function Icon({ name, size = 24, filled, className, style }: Props) {
  return (
    <span
      aria-hidden
      className={`${styles.icon} ${filled ? styles.filled : ''} ${className ?? ''}`}
      style={{ fontSize: size, ...style }}
    >
      {name}
    </span>
  )
}

export default Icon
