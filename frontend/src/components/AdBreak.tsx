import { useEffect } from 'react'
import adImage from '../assets/ad/ad-quiz.webp'
import { track, trackOnce } from '../lib/track.ts'
import styles from './AdBreak.module.css'

const AD_LINK = 'https://smartstore.naver.com/swiswi/products/13833093868'

// An ad shown in place of a question, inside the quiz frame.
function AdBreak({ categoryId, onClose }: { categoryId: string; onClose: () => void }) {
  useEffect(() => trackOnce(`AD_VIEW:${categoryId}`, 'AD_VIEW', categoryId), [categoryId])

  const skip = () => {
    track('AD_SKIP', categoryId)
    onClose()
  }

  return (
    <div className={styles.body}>
      <div className={styles.top}>
        <span className={styles.badge}>광고</span>
        <button type="button" className={styles.skip} onClick={skip}>
          건너뛰기
        </button>
      </div>
      <a
        className={styles.link}
        href={AD_LINK}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={() => track('AD_CLICK', categoryId)}
      >
        <img className={styles.image} src={adImage} alt="광고 이미지" />
      </a>
    </div>
  )
}

export default AdBreak
