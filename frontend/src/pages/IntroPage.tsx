import { Navigate, useNavigate, useParams } from 'react-router'
import Icon from '../components/Icon.tsx'
import TopBar from '../components/TopBar.tsx'
import ui from '../components/ui.module.css'
import { findCategory, QUESTION_COUNT } from '../data/categories.ts'
import { answeredCount, clearAnswers, firstUnanswered, useTestState } from '../store/testStore.ts'
import styles from './IntroPage.module.css'

function IntroPage() {
  const { catId } = useParams()
  const navigate = useNavigate()
  const { answers, results } = useTestState()
  const category = findCategory(catId)
  if (!category) return <Navigate to="/main" replace />

  const current = answers[category.id]
  const answered = answeredCount(current)
  const done = results[category.id] != null
  const first = category.questions[0]

  const start = () => {
    if (answered > 0) {
      const next = firstUnanswered(current)
      navigate(`/test/${category.id}/q/${(next < 0 ? QUESTION_COUNT - 1 : next) + 1}`)
      return
    }
    clearAnswers(category.id)
    navigate(`/test/${category.id}/q/1`)
  }

  const startLabel = answered > 0 ? `이어서 하기 (${answered}/${QUESTION_COUNT})` : done ? '다시 테스트하기' : '테스트 시작하기'

  return (
    <div className={ui.page}>
      <TopBar left={{ icon: 'arrow_back', label: '홈으로', onClick: () => navigate('/main') }} />

      <div className={styles.head}>
        <div className={styles.icon} style={{ background: category.tint.bg, color: category.tint.fg }}>
          <Icon name={category.icon} size={54} />
        </div>
        <div className={styles.name} style={{ color: category.tint.fg }}>
          {category.name} 테스트
        </div>
        <h1 className={styles.tagline}>{category.tagline}</h1>
        <div className={styles.chips}>
          <span className={styles.chip}>총 {QUESTION_COUNT}문항</span>
          <span className={styles.chip}>약 {category.minutes}분 소요</span>
          <span className={styles.chip}>{category.participants.toLocaleString('ko-KR')}명 참여</span>
        </div>
      </div>

      <div className={`${ui.card} ${styles.recommend}`}>
        <div className={styles.recTitle}>이런 사람에게 추천해요</div>
        <ul className={styles.recList}>
          {category.recommend.map((r) => (
            <li key={r} className={styles.recItem}>
              <Icon name="check_circle" size={18} className={styles.check} />
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div className={`${ui.card} ${styles.preview}`}>
        <div className={styles.previewLabel}>미리보기 · Q1</div>
        <div className={styles.previewPrompt}>{first.prompt}</div>
        <div className={styles.vsRow}>
          <span className={styles.optA}>{first.a}</span>
          <span className={styles.vs}>VS</span>
          <span className={styles.optB}>{first.b}</span>
        </div>
      </div>

      <div className={ui.spacer} />
      <div className={`${ui.stickyBottom} ${styles.actions}`}>
        <button type="button" className={`${ui.primary} ${ui.large}`} onClick={start}>
          {startLabel}
        </button>
        {done && (
          <button type="button" className={styles.ghost} onClick={() => navigate(`/result/${category.id}`)}>
            이전 결과 보기
          </button>
        )}
      </div>
    </div>
  )
}

export default IntroPage
