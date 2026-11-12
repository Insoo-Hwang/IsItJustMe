import { useEffect } from 'react'
import type { Ad, AdPlacement } from '../lib/ads.ts'
import { track, trackOnce } from '../lib/track.ts'
import styles from './AdBreak.module.css'

type Props = {
  ad: Ad
  placement: AdPlacement
  // the test the ad interrupted, when it sits inside one
  categoryId?: string
  // compact: a smaller ad inside a screen that moves on by itself, so no skip button
  variant?: 'full' | 'compact'
  onClose?: () => void
}

// An ad shown in place of the page's own content: full height with a skip button, or
// compact inside a screen that moves on by itself.
function AdBreak({ ad, placement, categoryId, variant = 'full', onClose }: Props) {
  const ref = { id: ad.id, placement }
  useEffect(
    () => trackOnce(`AD_VIEW:${placement}:${categoryId ?? ''}:${ad.id}`, 'AD_VIEW', categoryId, { id: ad.id, placement }),
    [ad.id, placement, categoryId],
  )

  const skip = () => {
    track('AD_SKIP', categoryId, ref)
    onClose?.()
  }

  return (
    <div className={`${styles.body} ${variant === 'compact' ? styles.compact : ''}`}>
      <div className={styles.top}>
        <span className={styles.badge}>광고</span>
        {onClose && (
          <button type="button" className={styles.skip} onClick={skip}>
            건너뛰기
          </button>
        )}
      </div>
      <a
        className={styles.link}
        href={ad.link}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={() => track('AD_CLICK', categoryId, ref)}
      >
        <img className={styles.image} src={ad.image} alt={`${ad.advertiser} 광고`} />
      </a>
    </div>
  )
}

export default AdBreak
