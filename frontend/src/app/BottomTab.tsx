import { Link, useLocation } from 'react-router'
import Icon from '../components/Icon.tsx'
import { useSheet } from '../hooks/useSheet.ts'
import styles from './AppShell.module.css'

const TABS = [
  { to: '/main', icon: 'home', label: '홈' },
  { to: '/dex', icon: 'style', label: '도감' },
  { to: '/stats', icon: 'bar_chart', label: '통계' },
]

function BottomTab() {
  const { pathname } = useLocation()
  const menu = useSheet('menu')

  return (
    <nav className={styles.tabsWrap} aria-label="주요 메뉴">
      <div className={styles.tabs}>
        {TABS.map((t) => {
          const active = !menu.isOpen && (pathname === t.to || pathname.startsWith(`${t.to}/`))
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon name={t.icon} />
              {t.label}
            </Link>
          )
        })}
        <button type="button" className={`${styles.tab} ${menu.isOpen ? styles.tabActive : ''}`} onClick={menu.open}>
          <Icon name="more_horiz" />
          더보기
        </button>
      </div>
    </nav>
  )
}

export default BottomTab
