import { useEffect, useRef, useState } from 'react'
import { adDetail, adTitle, drawAd, type AdPlacement } from '../lib/ads.ts'
import { track, trackOnce } from '../lib/track.ts'
import styles from './AdCard.module.css'

type Props = {
  placement: AdPlacement
  // the category the page is about, when it has one
  categoryId?: string
  className?: string
}

// Seen means half of the card stayed on screen this long, the usual bar for a display ad.
const SEEN_AFTER_MS = 1000

// A small ad card between the sections of a result: the product photo, its name and
// option as the store writes them, and where the link goes. Nothing else is claimed about
// it. The view counts only once half of the card has stayed on screen for a second, so an
// ad scrolled past or never reached is not reported as seen.
function AdCard({ placement, categoryId, className }: Props) {
  // one ad per visit of the page
  const [ad] = useState(() => drawAd(placement))
  const ref = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!ad || !el) return
    const report = () =>
      trackOnce(`AD_VIEW:${placement}:${categoryId ?? ''}:${ad.id}`, 'AD_VIEW', categoryId, { id: ad.id, placement })
    if (typeof IntersectionObserver === 'undefined') {
      report()
      return
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver(
      (entries) => {
        clearTimeout(timer)
        if (entries.some((e) => e.isIntersecting)) {
          timer = setTimeout(() => {
            report()
            observer.disconnect()
          }, SEEN_AFTER_MS)
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [ad, placement, categoryId])

  if (!ad) return null
  return (
    <a
      ref={ref}
      className={`${styles.card} ${className ?? ''}`}
      href={ad.link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => track('AD_CLICK', categoryId, { id: ad.id, placement })}
    >
      <img className={styles.image} src={ad.image} alt="" loading="lazy" />
      <span className={styles.text}>
        <span className={styles.meta}>
          <span className={styles.badge}>광고</span>
          {ad.advertiser}
        </span>
        <span className={styles.name}>{adTitle(ad)}</span>
        <span className={styles.detail}>{adDetail(ad)}</span>
        <span className={styles.more}>스마트스토어에서 보기 ›</span>
      </span>
    </a>
  )
}

export default AdCard
