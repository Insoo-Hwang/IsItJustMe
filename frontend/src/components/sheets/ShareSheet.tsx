import type { Category } from '../../data/categories.ts'
import { useSheet } from '../../hooks/useSheet.ts'
import type { RarityResult } from '../../lib/rarity.ts'
import { shareUrl } from '../../lib/share.ts'
import { showToast } from '../../lib/toast.ts'
import BottomSheet from '../BottomSheet.tsx'
import styles from './Sheets.module.css'

type Props = {
  category: Category
  result: RarityResult
  shareId: string
}

function ShareSheet({ category, result, shareId }: Props) {
  const sheet = useSheet('share')
  if (!sheet.isOpen) return null

  const url = shareUrl(shareId)
  const rare = result.rareTop3[0]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      showToast('링크를 복사했어요')
    } catch {
      showToast('복사하지 못했어요')
    }
  }

  return (
    <BottomSheet label="결과 카드 공유하기" onClose={sheet.close}>
      <div className={styles.title}>결과 카드 공유하기</div>
      <div className={styles.mini}>
        <div className={styles.miniBadge}>{result.tier}</div>
        <div className={styles.miniBody}>
          <div className={styles.miniBrand}>나의 희귀도 테스트 · {category.name}</div>
          <div className={styles.miniHeadline}>{result.headline}</div>
          <div className={styles.miniRare}>
            {rare.prompt} {rare.choice} · {rare.rate}%
          </div>
        </div>
      </div>
      <div className={styles.linkRow}>
        <span className={styles.linkText}>{url.replace(/^https?:\/\//, '')}</span>
        <button type="button" className={styles.copyButton} onClick={copy}>
          링크 복사
        </button>
      </div>
      <p className={styles.shareHint}>링크를 받은 친구가 테스트를 마치면 서로 얼마나 같은지 비교할 수 있어요.</p>
    </BottomSheet>
  )
}

export default ShareSheet
