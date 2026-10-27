import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useScrollContainer } from '../app/scrollContainer.ts'
import Icon from '../components/Icon.tsx'
import { CATEGORIES, QUESTION_COUNT, totalParticipants } from '../data/categories.ts'
import { answeredCount, firstUnanswered, useTestState } from '../store/testStore.ts'
import styles from './LandingPage.module.css'

function LandingPage() {
  const navigate = useNavigate()
  const { answers, results } = useTestState()
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useScrollContainer()

  // Drive the hero fade and sheet curve from scroll without re-rendering.
  useEffect(() => {
    const container = scrollRef.current
    const root = rootRef.current
    if (!container || !root) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => root.style.setProperty('--y', String(container.scrollTop)))
    }
    onScroll()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      container.removeEventListener('scroll', onScroll)
    }
  }, [scrollRef])

  const inProgress = CATEGORIES.find((c) => answeredCount(answers[c.id]) > 0)
  const inProgressCount = answeredCount(inProgress && answers[inProgress.id])

  const resume = () => {
    if (!inProgress) return
    const next = firstUnanswered(answers[inProgress.id])
    navigate(`/test/${inProgress.id}/q/${(next < 0 ? QUESTION_COUNT - 1 : next) + 1}`)
  }

  return (
    <div ref={rootRef} className={styles.landing}>
      <section className={styles.hero}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoMark} />
            나의 희귀도 테스트
          </div>
          <button type="button" className={styles.meButton} onClick={() => navigate('/me')}>
            <Icon name="person" size={18} />
            나의 정보
          </button>
        </div>
        <div className={styles.badge}>취향 희귀도 측정소</div>
        <h1 className={styles.headline}>
          내 취향, 나랑 똑같은
          <br />
          사람이 있을까?
        </h1>
        <div className={styles.bubbles} aria-hidden>
          <div className={`${styles.bubble} ${styles.bubbleCoral}`}>
            탕수육은
            <br />
            찍먹?
          </div>
          <div className={`${styles.bubble} ${styles.bubbleBlue}`}>
            민트초코는
            <br />
            호?
          </div>
          <div className={`${styles.bubble} ${styles.bubbleButter}`}>부먹!</div>
          <div className={`${styles.bubble} ${styles.bubblePill}`}>아침형?</div>
          <div className={styles.speech}>
            나와 취향이 비슷한 사람은
            <br />
            얼마나 있을까?
          </div>
          <span className={styles.dot} style={{ left: 178, top: 150, width: 16, height: 16, background: 'var(--ink)' }} />
          <span className={styles.dot} style={{ right: 120, top: 270, width: 12, height: 12, background: 'var(--coral)' }} />
          <span
            className={styles.dot}
            style={{ right: 8, top: 262, width: 22, height: 22, boxShadow: 'inset 0 0 0 2px var(--blue)' }}
          />
        </div>
        <div className={styles.participants}>
          <span>
            지금까지 <b>{totalParticipants().toLocaleString('ko-KR')}명</b>이 참여했어요
          </span>
          <Icon name="keyboard_double_arrow_down" size={26} className={styles.scrollHint} />
        </div>
      </section>

      <section id="categories" className={styles.sheet}>
        <div className={styles.sheetHead}>
          <h2 className={styles.sheetTitle}>어떤 취향부터 볼까요?</h2>
          <p className={styles.sheetSub}>카테고리마다 {QUESTION_COUNT}문항, 1분이면 끝나요</p>
        </div>

        {inProgress && (
          <button type="button" className={styles.resume} onClick={resume}>
            <Icon name="play_circle" />
            <span className={styles.resumeText}>
              <span className={styles.resumeTitle}>{inProgress.name} 이어하기</span>
              <span className={styles.resumeSub}>
                {inProgressCount}/{QUESTION_COUNT} · 남은 질문 {QUESTION_COUNT - inProgressCount}개
              </span>
            </span>
            <Icon name="chevron_right" size={22} />
          </button>
        )}

        <div className={styles.grid}>
          {CATEGORIES.map((c) => {
            const result = results[c.id]
            return (
              <button
                key={c.id}
                type="button"
                className={styles.catCard}
                style={{ background: c.tint.bg }}
                onClick={() => navigate(result ? `/result/${c.id}` : `/test/${c.id}`)}
                aria-label={result ? `${c.name} 결과 보기` : undefined}
              >
                {result && (
                  <span className={styles.doneBadge} aria-hidden>
                    <Icon name="check" size={20} />
                  </span>
                )}
                <span className={styles.catIcon} style={{ color: c.tint.fg }}>
                  <Icon name={c.icon} size={30} />
                </span>
                <span className={styles.catText}>
                  <span className={styles.catName}>{c.name}</span>
                  <span className={styles.catDesc}>{c.desc}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ height: 24 }} />
      </section>
    </div>
  )
}

export default LandingPage
