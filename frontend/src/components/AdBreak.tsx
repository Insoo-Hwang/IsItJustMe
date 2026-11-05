import adImage from '../assets/ad/ad-quiz.webp'
import styles from './AdBreak.module.css'

const AD_LINK = 'https://smartstore.naver.com/swiswi/products/13833093868'

// An ad shown in place of a question, inside the quiz frame.
function AdBreak({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.body}>
      <div className={styles.top}>
        <span className={styles.badge}>광고</span>
        <button type="button" className={styles.skip} onClick={onClose}>
          건너뛰기
        </button>
      </div>
      <a className={styles.link} href={AD_LINK} target="_blank" rel="noopener noreferrer sponsored">
        <img className={styles.image} src={adImage} alt="광고 이미지" />
      </a>
    </div>
  )
}

export default AdBreak
