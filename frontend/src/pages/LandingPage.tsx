import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import Icon from '../components/Icon.tsx'
import ui from '../components/ui.module.css'
import { CATEGORIES, QUESTION_COUNT, totalTests } from '../data/categories.ts'
import { withAnd } from '../lib/korean.ts'
import { invitePath, useInviteRoom } from '../lib/room.ts'
import { showToast } from '../lib/toast.ts'
import { answeredCount, dropRetakes, firstUnanswered, useTestState } from '../store/testStore.ts'
import styles from './LandingPage.module.css'

// A crowd of people as dots, one of them the rare one.
const COLUMNS = 10
const ROWS = 6
const GAP = 34
const ME = { col: 7, row: 2 }
// a few people close to "me", drawn a shade darker
const NEAR = new Set(['6,2', '7,1', '8,3', '7,3', '6,1'])

function CrowdField() {
  return (
    <svg className={styles.field} viewBox={`0 0 ${COLUMNS * GAP} ${ROWS * GAP}`} aria-hidden>
      {Array.from({ length: ROWS }, (_, row) =>
        Array.from({ length: COLUMNS }, (_, col) => {
          const cx = GAP / 2 + col * GAP
          const cy = GAP / 2 + row * GAP
          if (col === ME.col && row === ME.row) {
            return (
              <g key={`${col},${row}`}>
                <circle className={styles.pulse} cx={cx} cy={cy} r={8} />
                <circle className={styles.me} cx={cx} cy={cy} r={8} />
              </g>
            )
          }
          return (
            <circle
              key={`${col},${row}`}
              className={NEAR.has(`${col},${row}`) ? styles.near : styles.person}
              cx={cx}
              cy={cy}
              r={6}
              style={{ animationDelay: `${(col + row) * 40}ms` }}
            />
          )
        }),
      )}
    </svg>
  )
}

function LandingPage() {
  const navigate = useNavigate()
  const { answers, results } = useTestState()
  const invited = useInviteRoom()

  // a retake left without a clean exit (closed tab, reload) is dropped here
  useEffect(() => dropRetakes(), [results])

  const doneCount = CATEGORIES.filter((c) => results[c.id]).length
  const allDone = doneCount === CATEGORIES.length

  const openInvite = () => {
    if (!invited) return
    if (allDone) navigate(invitePath(invited.token))
    else showToast(`테스트 ${CATEGORIES.length}개를 모두 끝내면 비교할 수 있어요`)
  }

  // the first unanswered question of a test in progress
  const questionPath = (catId: string) => {
    const next = firstUnanswered(answers[catId])
    return `/test/${catId}/q/${(next < 0 ? QUESTION_COUNT - 1 : next) + 1}`
  }

  return (
    <div className={styles.landing}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoMark} aria-hidden>
            <span />
          </span>
          나만 그래?
        </div>
        <button type="button" className={styles.meButton} onClick={() => navigate('/me')}>
          <Icon name="person" size={18} />
          나의 정보
        </button>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>취향 테스트</p>
        <h1 className={styles.headline}>
          내 취향, 나랑 똑같은
          <br />
          사람이 있을까?
        </h1>
        <p className={styles.lede}>
          {CATEGORIES.length}가지 주제, {CATEGORIES.length * QUESTION_COUNT}개의 질문으로 다른 사람들 사이에서 내 취향이
          얼마나 드문지 알려드려요.
        </p>
        <CrowdField />
        <div className={styles.heroFoot}>
          <span className={styles.total}>
            <b>{totalTests().toLocaleString('ko-KR')}</b>건의 테스트가 진행됐어요
          </span>
        </div>
      </section>

      <section id="categories" className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>어떤 취향부터 볼까요?</h2>
          <p className={styles.sectionSub}>
            카테고리마다 {QUESTION_COUNT}문항, 1분이면 끝나요
          </p>
        </div>

        <div className={styles.grid}>
          {CATEGORIES.map((c) => {
            const result = results[c.id]
            // a test in progress goes straight back to its next question, even when retaking a finished one
            const progress = answeredCount(answers[c.id])
            const showResult = result && progress === 0
            const target = progress > 0 ? questionPath(c.id) : showResult ? `/result/${c.id}` : `/test/${c.id}`
            return (
              <button
                key={c.id}
                type="button"
                className={styles.catCard}
                onClick={() => navigate(target)}
                aria-label={progress > 0 ? `${c.name} 이어하기` : showResult ? `${c.name} 결과 보기` : undefined}
              >
                <span className={styles.catIcon} style={{ background: c.tint.bg, color: c.tint.fg }}>
                  <Icon name={c.icon} size={24} filled />
                </span>
                {progress > 0 ? (
                  <span className={`${styles.doneBadge} ${styles.progressBadge}`} aria-hidden>
                    <Icon name="pending" size={14} />
                    {progress}/{QUESTION_COUNT}
                  </span>
                ) : (
                  result && (
                    <span className={styles.doneBadge} aria-hidden>
                      <Icon name="check" size={14} />
                      완료
                    </span>
                  )
                )}
                <span className={styles.catText}>
                  <span className={styles.catName}>{c.name}</span>
                  <span className={styles.catDesc}>{c.desc}</span>
                </span>
              </button>
            )
          })}
        </div>

        {allDone ? (
          <section className={`${styles.final} ${styles.finalOpen}`} aria-label="최종 결과">
            <div className={styles.finalHead}>
              <span className={styles.finalLabel}>
                <Icon name="auto_awesome" size={20} filled className={styles.sparkle} />
                모든 취향을 알아봤어요!
              </span>
              <span className={styles.finalBadge}>
                {doneCount}/{CATEGORIES.length}
              </span>
            </div>
            <p className={styles.finalSub}>이제 마지막 비교 상대를 확인할 차례예요.</p>
            <button type="button" className={`${ui.primary} ${ui.large} ${styles.finalButton}`} onClick={() => navigate('/summary')}>
              나의 최종 결과 확인하기
              <Icon name="arrow_forward" size={20} className={styles.finalArrow} />
            </button>
          </section>
        ) : (
          <section className={styles.final} aria-label="마지막 결과">
            <div className={styles.finalHead}>
              <span className={styles.finalLabel}>
                <Icon name="lock" size={18} />
                마지막 결과
              </span>
              <span className={styles.finalCount}>
                {doneCount}/{CATEGORIES.length}
              </span>
            </div>
            <h3 className={styles.finalTitle}>당신과 똑같은 사람은 몇 명일까요?</h3>
            <p className={styles.finalSub}>희귀도 순위, 완전히 일치하는 사람, 그리고 마지막 비교 상대까지.</p>
            <span className={styles.finalTrack} aria-hidden>
              <span style={{ width: `${(doneCount / CATEGORIES.length) * 100}%` }} />
            </span>
            <p className={styles.finalHint}>{CATEGORIES.length - doneCount}개의 취향만 더 알아보면 공개돼요</p>
          </section>
        )}

        {invited && (
          <button
            type="button"
            className={`${styles.compare} ${allDone ? '' : styles.compareLocked}`}
            aria-disabled={!allDone}
            onClick={openInvite}
          >
            <Icon name={allDone ? 'public' : 'lock'} size={20} />
            <span className={styles.compareText}>{withAnd(invited.room.ownerName)} 비교하기</span>
            <Icon name="chevron_right" size={20} />
          </button>
        )}
      </section>

      <footer className={styles.footer}>
        <nav className={styles.footerLinks} aria-label="정책">
          <Link to="/privacy">개인정보처리방침</Link>
          <span aria-hidden>·</span>
          <Link to="/terms">이용약관</Link>
        </nav>
        <p>© 나만 그래?</p>
      </footer>
    </div>
  )
}

export default LandingPage
