import { CATEGORIES } from '../../data/categories.ts'
import { useSheet } from '../../hooks/useSheet.ts'
import { showToast } from '../../lib/toast.ts'
import { useTestState } from '../../store/testStore.ts'
import BottomSheet from '../BottomSheet.tsx'
import Icon from '../Icon.tsx'
import styles from './Sheets.module.css'

function MenuSheet() {
  const sheet = useSheet('menu')
  const { results } = useTestState()
  if (!sheet.isOpen) return null

  const firstDone = CATEGORIES.find((c) => results[c.id])

  const items = [
    { icon: 'history', label: '내 결과 불러오기', go: () => sheet.go({ search: '?sheet=restore' }) },
    {
      icon: 'group',
      label: '친구에게 비교 링크 보내기',
      go: () =>
        firstDone ? sheet.go(`/result/${firstDone.id}?sheet=share`) : showToast('먼저 테스트를 완료해주세요'),
    },
    { icon: 'style', label: '취향 도감', go: () => sheet.go('/dex') },
    { icon: 'bar_chart', label: '취향 통계', go: () => sheet.go('/stats') },
    { icon: 'grid_view', label: '다른 테스트 하러가기', go: () => sheet.go('/main#categories') },
  ]

  return (
    <BottomSheet label="더보기" onClose={sheet.close}>
      <div className={styles.title}>더보기</div>
      <div className={styles.menu}>
        {items.map((m) => (
          <button key={m.label} type="button" className={styles.menuItem} onClick={m.go}>
            <Icon name={m.icon} size={22} />
            <span className={styles.menuLabel}>{m.label}</span>
            <Icon name="chevron_right" size={20} className={styles.chevron} />
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}

export default MenuSheet
