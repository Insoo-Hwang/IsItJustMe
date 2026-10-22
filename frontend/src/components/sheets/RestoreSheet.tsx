import { useSheet } from '../../hooks/useSheet.ts'
import { showToast } from '../../lib/toast.ts'
import { resetAll, useTestState } from '../../store/testStore.ts'
import BottomSheet from '../BottomSheet.tsx'
import Icon from '../Icon.tsx'
import ui from '../ui.module.css'
import styles from './Sheets.module.css'

function RestoreSheet() {
  const sheet = useSheet('restore')
  const { results } = useTestState()
  if (!sheet.isOpen) return null

  const savedCount = Object.keys(results).length

  const showSaved = () => {
    if (savedCount > 0) sheet.go('/dex')
    else showToast('저장된 결과가 없어요')
  }

  const reset = () => {
    if (!window.confirm('이 기기에 저장된 답변과 결과를 모두 지울까요?')) return
    resetAll()
    sheet.go('/main')
    showToast('처음부터 시작해요')
  }

  return (
    <BottomSheet label="내 결과 불러오기" onClose={sheet.close}>
      <div className={styles.displayTitle}>내 결과 불러오기</div>
      <p className={styles.desc}>로그인 없이 이 기기에 결과가 저장돼요.</p>
      <div className={styles.savedRow}>
        <span className={styles.savedIcon}>
          <Icon name="history" size={22} />
        </span>
        <span className={styles.savedText}>
          <span className={styles.savedTitle}>
            {savedCount > 0 ? `이 기기에 저장된 결과 ${savedCount}개` : '아직 저장된 결과가 없어요'}
          </span>
          <span className={styles.savedSub}>테스트를 끝내면 자동으로 저장돼요</span>
        </span>
      </div>
      <button type="button" className={`${ui.dark} ${styles.fullButton}`} onClick={showSaved}>
        이전 결과 보기
      </button>
      <button type="button" className={styles.textButton} onClick={reset}>
        처음부터 다시하기
      </button>
    </BottomSheet>
  )
}

export default RestoreSheet
