import { Fragment, useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useScrollContainer } from '../app/scrollContainer.ts'
import AdCard from '../components/AdCard.tsx'
import Icon from '../components/Icon.tsx'
import tier from '../components/tier.module.css'
import ui from '../components/ui.module.css'
import {
  ASK,
  ENDINGS,
  GUESSES,
  INTRO,
  JOIN,
  MEMORY_QUESTIONS,
  REVEAL,
  STORY,
  afterLines,
  letterOf,
  memoryKey,
  planEnding,
  talkLines,
  type EndingPlan,
  type Guess,
  type MemoryAnswer,
  type Self,
} from '../data/ending.ts'
import { BACKGROUNDS, preloadArt, spriteOf } from '../data/endingArt.ts'
import { useSummary, type SummaryRow } from '../lib/summary.ts'
import { showToast } from '../lib/toast.ts'
import { trackOnce } from '../lib/track.ts'
import { saveEnding, useTestState } from '../store/testStore.ts'
import EndingDialogue from './EndingDialogue.tsx'
import styles from './EndingPage.module.css'

type Phase = 'intro' | 'reveal' | 'talk' | 'ask' | 'after' | 'letter'

// The guest's answers to the memory questions (question 10 of each category). A question
// whose code or options don't match STORY.md is left out instead of guessed.
function memoryAnswers(rows: SummaryRow[]): MemoryAnswer[] {
  return MEMORY_QUESTIONS.flatMap((q) => {
    const pick = rows.find((r) => r.category.id === q.category)?.rarity.picks.find((p) => p.id === q.question)
    if (!pick || pick.choice !== (pick.side === 'a' ? q.a : q.b)) return []
    return [{ category: q.category, side: pick.side, rate: pick.rate }]
  })
}

// A plan saved before STORY.md changed may name scenes that are gone.
function usable(plan: EndingPlan): boolean {
  const known = (m: { category: string }) => m.category in STORY.memories
  return plan.scenes.every(known) && plan.letter.every(known) && (plan.combo == null || STORY.combos.some((c) => c.id === plan.combo))
}

async function shareEnding(text: string) {
  const url = location.origin
  if (navigator.share) {
    try {
      await navigator.share({ title: '나만 그래?', text, url })
      return
    } catch (err) {
      // closed the share sheet
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    showToast('공유 문구를 복사했어요')
  } catch {
    showToast('공유하지 못했어요. 다시 시도해주세요')
  }
}

// The last match: the user's younger self. The dialogue and the letter are put together
// from the overall tier, the memory answers and the two picks made in the ending.
function EndingPage() {
  const navigate = useNavigate()
  const scrollRef = useScrollContainer()
  const state = useSummary()
  const saved = useTestState().ending
  const [phase, setPhase] = useState<Phase>('intro')
  const [guess, setGuess] = useState<Guess>('unsure')
  const [self, setSelf] = useState<Self>('unsure')

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [phase, scrollRef])

  const ready = state.status === 'ready' ? state.summary : null
  const tone = ready?.tier.tone ?? null
  useEffect(() => {
    if (!tone) return
    preloadArt(tone)
    trackOnce('ENDING_OPEN', 'ENDING_OPEN')
  }, [tone])

  // picks the combo when several match; fixed for the visit so the scenes don't change midway
  const [random] = useState(() => Math.random())
  const answers = useMemo(() => (ready ? memoryAnswers(ready.rows) : []), [ready])
  const key = memoryKey(answers)
  // rates move and the combo is random: the same memory answers keep the plan they got first
  const plan: EndingPlan = useMemo(
    () => (saved?.key === key && usable(saved.plan) ? saved.plan : planEnding(STORY, answers, random)),
    [saved, key, answers, random],
  )

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
  const savedHere = saved?.key === key && saved.plan === plan ? saved : null

  const pickGuess = (id: Guess) => {
    setGuess(id)
    setPhase('reveal')
  }
  const pickSelf = (id: Self) => {
    setSelf(id)
    setPhase('after')
  }
  const openLetter = () => {
    saveEnding({ key, plan, guess, self })
    setPhase('letter')
  }
  const readSaved = () => {
    if (!savedHere) return
    setGuess(savedHere.guess)
    setSelf(savedHere.self)
    setPhase('letter')
  }

  const letter = letterOf(STORY, overall.tone, guess, self, plan)
  const choices = <T extends string>(list: { id: T; label: string }[], onPick: (id: T) => void) => (
    <div className={styles.choices}>
      {list.map((c) => (
        <button key={c.id} type="button" className={styles.choice} onClick={() => onPick(c.id)}>
          {c.label}
        </button>
      ))}
    </div>
  )
  const talking = phase === 'talk' || phase === 'ask' || phase === 'after'

  return (
    <div
      className={`${styles.page} ${tier[overall.tone]} ${phase === 'letter' ? styles.letterPage : ''} ${talking ? styles.talkPage : ''}`}
      style={talking ? ({ '--ending-bg': `url(${BACKGROUNDS[overall.tone]})` } as CSSProperties) : undefined}
    >
      {phase === 'intro' && (
        <>
          {savedHere && (
            <div className={styles.talkHead}>
              <span />
              <button type="button" className={styles.skip} onClick={readSaved}>
                지난 편지 다시 읽기
              </button>
            </div>
          )}
          <EndingDialogue key="intro" lines={INTRO} choices={choices(GUESSES, pickGuess)} />
        </>
      )}

      {phase === 'reveal' && (
        <section className={styles.reveal} aria-label="마지막 비교 대상">
          <div className={styles.found}>LAST MATCH FOUND</div>
          <span className={styles.revealActor} aria-hidden>
            <img className={styles.revealSprite} src={spriteOf('past', 'default')} alt="" draggable={false} />
          </span>
          <h1 className={styles.revealName}>{REVEAL.name}</h1>
          <p className={styles.revealText}>
            {REVEAL.text.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </p>
          <button type="button" className={`${ui.dark} ${ui.large} ${styles.revealButton}`} onClick={() => setPhase('talk')}>
            {REVEAL.button}
          </button>
        </section>
      )}

      {talking && (
        <div className={styles.talkHead}>
          <span className={styles.sceneTitle}>「{ending.scene}」</span>
          {phase !== 'ask' && (
            <button type="button" className={styles.skip} onClick={phase === 'talk' ? () => setPhase('ask') : openLetter}>
              건너뛰기
            </button>
          )}
        </div>
      )}
      {phase === 'talk' && (
        <EndingDialogue key="talk" lines={talkLines(STORY, overall.tone, guess, plan)} onDone={() => setPhase('ask')} />
      )}
      {phase === 'ask' && <EndingDialogue key="ask" lines={ASK.talk} choices={choices(ASK.choices, pickSelf)} />}
      {phase === 'after' && <EndingDialogue key="after" lines={afterLines(STORY, self)} onDone={openLetter} />}

      {phase === 'letter' && (
        <article className={styles.letter}>
          <div className={styles.letterNo}>
            ENDING {ending.no} · {overall.tier}
          </div>
          <h1 className={styles.letterTitle}>{letter.title}</h1>
          <div className={styles.letterBody}>
            {[...letter.paragraphs, letter.signature].map((p, i) => (
              <p
                key={i}
                className={i === letter.paragraphs.length ? styles.signature : undefined}
                style={{ animationDelay: `${0.3 + Math.min(i, 12) * 0.25}s` }}
              >
                {p}
              </p>
            ))}
          </div>
          <p className={styles.lastLine}>{letter.last}</p>

          <section className={styles.endCard} aria-label="엔딩 카드">
            <div className={styles.endCardLabel}>나만 그래? · {overall.tier}</div>
            <p className={styles.endCardQuote}>{letter.last}</p>
            <p className={styles.endCardNote}>마지막 비교 상대는 나 자신이었어</p>
            <button type="button" className={`${ui.dark} ${styles.endCardShare}`} onClick={() => void shareEnding(`${JOIN.shareText}\n“${letter.last}”`)}>
              <Icon name="ios_share" size={20} />
              공유하기
            </button>
          </section>

          <div className={styles.letterActions}>
            <button type="button" className={`${ui.primary} ${ui.large}`} onClick={() => navigate('/summary')}>
              종합 결과로 돌아가기
            </button>
            <div className={styles.subActions}>
              <button type="button" className={styles.subAction} onClick={() => setPhase('intro')}>
                <Icon name="replay" size={20} />
                처음부터 다시
              </button>
              <button type="button" className={styles.subAction} onClick={() => navigate('/main')}>
                <Icon name="home" size={20} />
                홈으로
              </button>
            </div>
          </div>
          <AdCard placement="ENDING_BANNER" className={styles.ad} />
        </article>
      )}
    </div>
  )
}

export default EndingPage
