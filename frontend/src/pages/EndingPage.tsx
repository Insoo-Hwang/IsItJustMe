import { useLayoutEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useScrollContainer } from '../app/scrollContainer.ts'
import Icon from '../components/Icon.tsx'
import tier from '../components/tier.module.css'
import ui from '../components/ui.module.css'
import { ENDINGS, GREETINGS, GUESSES, INTRO, type Guess } from '../data/ending.ts'
import { useSummary } from '../lib/summary.ts'
import EndingDialogue from './EndingDialogue.tsx'
import styles from './EndingPage.module.css'

type Phase = 'intro' | 'reveal' | 'talk' | 'letter'

// The last match: the user's younger self, then a letter that depends on the overall tier.
function EndingPage() {
  const navigate = useNavigate()
  const scrollRef = useScrollContainer()
  const state = useSummary()
  const [phase, setPhase] = useState<Phase>('intro')
  const [guess, setGuess] = useState<Guess>('unsure')

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [phase, scrollRef])

  if (state.status === 'locked') return <Navigate to="/main" replace />
  if (state.status === 'missing') return <Navigate to={`/test/${state.categoryId}`} replace />
  if (state.status === 'error') {
    return (
      <div className={`${ui.page} ${styles.status}`} role="alert">
        결과를 불러오지 못했어요
        <button type="button" className={ui.secondary} onClick={state.retry}>
          다시 시도
        </button>
      </div>
    )
  }
  if (state.status === 'loading') {
    return (
      <div className={`${ui.page} ${styles.status}`} role="status">
        마지막 비교 대상을 찾는 중…
      </div>
    )
  }

  const { tier: overall } = state.summary
  const ending = ENDINGS[overall.tone]

  const pick = (id: Guess) => {
    setGuess(id)
    setPhase('reveal')
  }

  return (
    <div className={`${styles.page} ${tier[overall.tone]} ${phase === 'letter' ? styles.letterPage : ''}`}>
      {phase === 'intro' && (
        <EndingDialogue
          key="intro"
          lines={INTRO}
          choices={
            <div className={styles.choices}>
              {GUESSES.map((g) => (
                <button key={g.id} type="button" className={styles.choice} onClick={() => pick(g.id)}>
                  {g.label}
                </button>
              ))}
            </div>
          }
        />
      )}

      {phase === 'reveal' && (
        <section className={styles.reveal} aria-label="마지막 비교 대상">
          <div className={styles.found}>LAST MATCH FOUND</div>
          <span className={styles.revealActor} aria-hidden>
            <Icon name="face" size={72} />
          </span>
          <h1 className={styles.revealName}>몇 년 전의 나</h1>
          <p className={styles.revealText}>
            지금까지 다른 사람들과 비교하려고 했잖아.
            <br />
            마지막에는 예전의 나를 한번 만나보자.
          </p>
          <button type="button" className={`${ui.dark} ${ui.large} ${styles.revealButton}`} onClick={() => setPhase('talk')}>
            만나러 가기
          </button>
        </section>
      )}

      {phase === 'talk' && (
        <>
          <div className={styles.talkHead}>
            <span className={styles.sceneTitle}>「{ending.scene}」</span>
            <button type="button" className={styles.skip} onClick={() => setPhase('letter')}>
              건너뛰기
            </button>
          </div>
          <EndingDialogue key="talk" lines={[...GREETINGS[guess], ...ending.talk]} onDone={() => setPhase('letter')} />
        </>
      )}

      {phase === 'letter' && (
        <article className={styles.letter}>
          <div className={styles.letterNo}>
            ENDING {ending.no} · {overall.tier}
          </div>
          <h1 className={styles.letterTitle}>{ending.title}</h1>
          <div className={styles.letterBody}>
            {ending.letter.map((p, i) => (
              <p key={i} style={{ animationDelay: `${0.3 + Math.min(i, 12) * 0.25}s` }}>
                {p}
              </p>
            ))}
          </div>
          <div className={styles.letterActions}>
            <button type="button" className={`${ui.dark} ${ui.large}`} onClick={() => navigate('/summary')}>
              희귀도 보고서로 돌아가기
            </button>
            <div className={styles.subActions}>
              <button type="button" className={styles.subAction} onClick={() => setPhase('intro')}>
                <Icon name="replay" size={18} />
                처음부터 다시 보기
              </button>
              <button type="button" className={styles.subAction} onClick={() => navigate('/main')}>
                <Icon name="home" size={18} />
                홈으로
              </button>
            </div>
          </div>
        </article>
      )}
    </div>
  )
}

export default EndingPage
