import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { HttpError, submitAnswer } from '../api/categories.ts'
import { ensureGuestSession } from '../api/guest.ts'
import Icon from '../components/Icon.tsx'
import TopBar from '../components/TopBar.tsx'
import ui from '../components/ui.module.css'
import { findCategory, QUESTION_COUNT, toAnswerBits, type Category, type Choice } from '../data/categories.ts'
import { showToast } from '../lib/toast.ts'
import {
  answeredCount,
  completeTest,
  firstUnanswered,
  getTestState,
  setAnswer,
  setProfile,
  useTestState,
} from '../store/testStore.ts'
import ProfileStep from './ProfileStep.tsx'
import styles from './QuizPage.module.css'

const AUTO_ADVANCE_MS = 520
const ANALYZE_MS = 1500

function LoadingView({ category }: { category: Category }) {
  return (
    <div className={styles.loading} role="status">
      <div className={styles.balls} aria-hidden>
        <div className={styles.ball} style={{ background: 'var(--coral)' }} />
        <div className={styles.ball} style={{ background: 'var(--blue)', animationDelay: '0.15s' }} />
        <div className={styles.ball} style={{ background: 'var(--butter-deep)', animationDelay: '0.3s' }} />
      </div>
      <div>
        <div className={styles.loadingTitle}>취향 분석 중…</div>
        <div className={styles.loadingSub}>
          {category.participants.toLocaleString('ko-KR')}명의 답변과 비교하고 있어요
        </div>
      </div>
    </div>
  )
}

function QuizPage() {
  const { catId, n } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { answers } = useTestState()
  const [phase, setPhase] = useState<'quiz' | 'profile' | 'loading'>('quiz')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // A pending auto-advance belongs to the question it was set on.
  useEffect(() => () => clearTimeout(timer.current), [n])

  const category = findCategory(catId)
  if (!category) return <Navigate to="/main" replace />
  if (phase === 'loading') return <LoadingView category={category} />

  const id = category.id
  const current = answers[id] ?? []
  const answered = answeredCount(current)
  const empty = firstUnanswered(current)
  // furthest question the user may open: the first unanswered one
  const reachable = empty < 0 ? QUESTION_COUNT - 1 : empty
  const index = Number(n) - 1
  if (!Number.isInteger(index) || index < 0 || index > reachable) {
    return <Navigate to={`/test/${id}/q/${reachable + 1}`} replace />
  }

  const question = category.questions[index]
  const picked = current[index] ?? null
  const isLast = index === QUESTION_COUNT - 1

  const goNext = (from: number) => {
    const latest = getTestState().answers[id] ?? []
    if (latest[from] == null) {
      showToast('하나를 골라주세요')
      return
    }
    if (from < QUESTION_COUNT - 1) {
      navigate(`/test/${id}/q/${from + 2}`)
      return
    }
    const missing = firstUnanswered(latest)
    if (missing >= 0) {
      navigate(`/test/${id}/q/${missing + 1}`)
      return
    }
    void finish()
  }

  // Results need the profile first; ask for it only if the guest has none yet.
  const finish = async () => {
    let profile = getTestState().profile
    if (!profile) {
      try {
        profile = (await ensureGuestSession()).profile
        setProfile(profile)
      } catch (err) {
        console.error(err)
      }
    }
    if (profile) void submit()
    else setPhase('profile')
  }

  // Saves the answers while the analyzing screen shows for at least ANALYZE_MS.
  const submit = async () => {
    const latest = getTestState().answers[id] ?? []
    setPhase('loading')
    try {
      await Promise.all([
        submitAnswer(id, toAnswerBits(latest as Choice[])),
        new Promise((resolve) => setTimeout(resolve, ANALYZE_MS)),
      ])
    } catch (err) {
      console.error(err)
      if (err instanceof HttpError && err.status === 409) {
        // the guest has no profile on the server yet
        setProfile(null)
        setPhase('profile')
        return
      }
      showToast('결과를 저장하지 못했어요. 다시 시도해주세요')
      setPhase('quiz')
      return
    }
    completeTest(id)
    queryClient.removeQueries({ queryKey: ['result', id] })
    queryClient.removeQueries({ queryKey: ['result', 'all'] })
    navigate(`/result/${id}`, { replace: true })
  }

  if (phase === 'profile') {
    return <ProfileStep title={category.name} backLabel="마지막 질문으로" onBack={() => setPhase('quiz')} onDone={() => void submit()} />
  }

  const pick = (choice: Choice) => {
    setAnswer(id, index, choice)
    // Only the first answer moves on by itself; changing an answer stays put.
    if (picked == null) {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => goNext(index), AUTO_ADVANCE_MS)
    }
  }

  const prev = () => {
    clearTimeout(timer.current)
    navigate(index === 0 ? `/test/${id}` : `/test/${id}/q/${index}`)
  }

  const choiceState = (side: Choice) => (picked == null ? 'idle' : picked === side ? 'selected' : 'dimmed')

  return (
    <div className={`${ui.page} ${styles.quiz}`}>
      <TopBar
        title={category.name}
        left={{ icon: 'arrow_back', label: '이전 질문', onClick: prev }}
        right={{ icon: 'close', label: '그만하기', onClick: () => navigate('/main'), muted: true }}
      />
      <div className={styles.counter}>
        <div className={styles.count}>
          <span className={styles.countNow}>{index + 1}</span> / {QUESTION_COUNT}
        </div>
        <div className={styles.remain}>
          {answered === QUESTION_COUNT ? '모두 답했어요!' : `남은 질문 ${QUESTION_COUNT - answered}개`}
        </div>
      </div>
      <div
        className={styles.bar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={QUESTION_COUNT}
        aria-valuenow={answered}
        aria-label="진행률"
      >
        <div className={styles.barFill} style={{ width: `${(answered / QUESTION_COUNT) * 100}%` }} />
      </div>
      <div className={styles.dots}>
        {category.questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            aria-label={`${i + 1}번 질문`}
            aria-current={i === index ? 'step' : undefined}
            disabled={i > reachable}
            className={`${styles.dot} ${current[i] != null ? styles.dotDone : ''} ${i === index ? styles.dotCurrent : ''}`}
            onClick={() => navigate(`/test/${id}/q/${i + 1}`)}
          />
        ))}
      </div>

      <div className={styles.body}>
        <div className={styles.qLabel}>Q{index + 1}</div>
        <h1 className={styles.prompt}>{question.prompt}</h1>
        <div className={styles.choices}>
          {(['a', 'b'] as const).map((side) => (
            <button
              key={side}
              type="button"
              className={styles.choice}
              data-side={side}
              data-state={choiceState(side)}
              aria-pressed={picked === side}
              onClick={() => pick(side)}
            >
              <span className={styles.choiceBadge}>{side.toUpperCase()}</span>
              <span className={styles.choiceLabel}>{question[side]}</span>
              {picked === side && <Icon name="check_circle" size={28} className={styles.choiceCheck} />}
            </button>
          ))}
          <div className={styles.vs} aria-hidden>
            VS
          </div>
        </div>
        <div className={styles.hint}>
          {picked == null ? '고르면 바로 다음 질문으로 넘어가요' : '다른 쪽을 누르면 답을 바꿀 수 있어요'}
        </div>
      </div>

      <div className={`${ui.stickyBottom} ${styles.nav}`}>
        <button type="button" className={`${ui.secondary} ${styles.navPrev}`} onClick={prev}>
          이전
        </button>
        <button
          type="button"
          className={`${ui.dark} ${picked == null ? styles.navNextEmpty : ''}`}
          aria-disabled={picked == null}
          onClick={() => {
            clearTimeout(timer.current)
            goNext(index)
          }}
        >
          {isLast ? '결과 보기' : '다음'}
        </button>
      </div>
    </div>
  )
}

export default QuizPage
