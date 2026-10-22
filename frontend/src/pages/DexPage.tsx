import { useNavigate } from 'react-router'
import Icon from '../components/Icon.tsx'
import ui from '../components/ui.module.css'
import { CATEGORIES } from '../data/categories.ts'
import { analyze } from '../lib/rarity.ts'
import { useTestState } from '../store/testStore.ts'
import styles from './DexPage.module.css'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

function DexPage() {
  const navigate = useNavigate()
  const { results } = useTestState()
  const done = CATEGORIES.filter((c) => results[c.id])
  const todo = CATEGORIES.filter((c) => !results[c.id])

  return (
    <div className={ui.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>취향 도감</h1>
        <p className={styles.sub}>
          모은 취향 카드 <b>{done.length}</b> / {CATEGORIES.length}
        </p>
      </div>
      <div className={styles.stamps} aria-hidden>
        {CATEGORIES.map((c) => (
          <span
            key={c.id}
            className={`${styles.stamp} ${results[c.id] ? styles.stampDone : ''}`}
            style={results[c.id] ? { background: c.tint.bg, color: c.tint.fg } : undefined}
          >
            <Icon name={c.icon} size={20} />
          </span>
        ))}
      </div>

      {done.length === 0 ? (
        <div className={`${ui.card} ${styles.empty}`}>
          <div className={styles.emptyArt} aria-hidden>
            <span style={{ left: 0, top: 10, width: 70, height: 70, boxShadow: 'inset 0 0 0 2px oklch(0.85 0.01 290)' }} />
            <span style={{ right: 0, top: 0, width: 60, height: 60, background: 'var(--coral-soft)' }} />
            <span style={{ left: 52, bottom: 0, width: 22, height: 22, background: 'var(--butter-deep)' }} />
          </div>
          <div className={styles.emptyTitle}>아직 모은 카드가 없어요</div>
          <p className={styles.emptyBody}>
            테스트를 끝낼 때마다
            <br />
            취향 카드가 한 장씩 쌓여요
          </p>
          <button
            type="button"
            className={`${ui.primary} ${ui.inline} ${styles.emptyCta}`}
            onClick={() => navigate('/main#categories')}
          >
            첫 테스트 하러 가기
          </button>
        </div>
      ) : (
        <>
          <h2 className={styles.section}>완료한 테스트</h2>
          <div className={styles.doneGrid}>
            {done.map((c) => {
              const saved = results[c.id]
              const r = analyze(c, saved.answers)
              return (
                <button
                  key={c.id}
                  type="button"
                  className={styles.doneCard}
                  style={{ background: c.tint.bg }}
                  onClick={() => navigate(`/result/${c.id}`)}
                >
                  <span className={styles.doneTop}>
                    <span className={styles.doneIcon} style={{ color: c.tint.fg }}>
                      <Icon name={c.icon} size={22} />
                    </span>
                    <span className={styles.date}>{formatDate(saved.completedAt)}</span>
                  </span>
                  <span className={styles.doneName}>{c.name}</span>
                  <span className={styles.doneTier}>{r.tier}</span>
                  <span className={styles.doneRatio}>100명 중 {r.top}명</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {todo.length > 0 && (
        <>
          <h2 className={styles.section}>아직 안 해본 테스트</h2>
          <div className={styles.todoList}>
            {todo.map((c) => (
              <button key={c.id} type="button" className={styles.todo} onClick={() => navigate(`/test/${c.id}`)}>
                <span className={styles.todoIcon}>
                  <Icon name={c.icon} size={22} />
                </span>
                <span className={styles.todoText}>
                  <span className={styles.todoName}>{c.name}</span>
                  <span className={styles.todoDesc}>{c.desc}</span>
                </span>
                <span className={styles.todoStart}>시작</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div style={{ height: 24 }} />
    </div>
  )
}

export default DexPage
