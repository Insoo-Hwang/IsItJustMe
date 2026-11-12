import type { Question } from '../data/categories.ts'
import type { PickedChoice } from '../lib/rarity.ts'
import DebateShareButton from './DebateShareButton.tsx'
import styles from './ResultHighlights.module.css'
import ui from './ui.module.css'

type Props = {
  categoryId: string
  questions: Question[]
  picks: PickedChoice[]
  // contested: the question that split everyone closest to half and half
  // debate: my rarest pick, as a debate to send to friends
  show: 'contested' | 'debate'
}

// One of two cards for a category result; the page places each on its own.
function ResultHighlights({ categoryId, questions, picks, show }: Props) {
  if (picks.length === 0) return null
  const rarest = picks.reduce((min, p) => (p.rate < min.rate ? p : min))
  const aRateOf = (p: PickedChoice) => (p.side === 'a' ? p.rate : 100 - p.rate)
  const contested = picks.reduce((best, p) => (Math.abs(aRateOf(p) - 50) < Math.abs(aRateOf(best) - 50) ? p : best))
  const contestedQuestion = questions[contested.n - 1]
  const contestedA = Math.round(aRateOf(contested))
  const rarestRate = Math.round(rarest.rate)

  if (show === 'contested') {
    if (!contestedQuestion) return null
    return (
      <section className={`${ui.card} ${styles.card}`} aria-label="가장 치열했던 질문">
        <span className={`${styles.badge} ${styles.fightBadge}`}>⚔️ 가장 치열했던 질문</span>
        <p className={styles.fightPrompt}>{contested.prompt}</p>
        <div className={styles.split} aria-hidden>
          <span className={styles.splitA} style={{ flexGrow: Math.max(contestedA, 8) }}>
            {contestedA}%
          </span>
          <span className={styles.splitB} style={{ flexGrow: Math.max(100 - contestedA, 8) }}>
            {100 - contestedA}%
          </span>
        </div>
        <div className={styles.splitLabels}>
          {(['a', 'b'] as const).map((side) => (
            <span key={side} className={styles.splitLabel} data-side={side}>
              {contestedQuestion[side]}
              {contested.side === side && <span className={styles.mineTag}>내 선택</span>}
            </span>
          ))}
        </div>
        <p className={styles.note}>
          {picks.length}문항 중 의견이 가장 팽팽하게 갈렸어요 · 차이 {Math.abs(contestedA * 2 - 100)}%p
        </p>
      </section>
    )
  }

  return (
    <section className={`${ui.card} ${styles.card}`} aria-label="나만 그래?">
      <span className={`${styles.badge} ${styles.hotBadge}`}>🔥 나만 그래?</span>
      <div className={styles.hotRate}>
        단 <b>{rarestRate}%</b>만 고른 선택
      </div>
      <p className={styles.hotPrompt}>{rarest.prompt}</p>
      <div className={styles.hotPick} data-side={rarest.side}>
        나는 <b>'{rarest.choice}'</b> 파
      </div>
      <p className={styles.hotTaunt}>나머지 {100 - rarestRate}%는 반대쪽을 골랐어요. 나만 그런 거야?</p>
      <DebateShareButton
        className={`${ui.primary} ${ui.large} ${styles.hotButton}`}
        categoryId={categoryId}
        n={rarest.n}
        pick={rarest.side}
        prompt={rarest.prompt}
        choice={rarest.choice}
        rate={rarest.rate}
      />
    </section>
  )
}

export default ResultHighlights
