import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchPlanet } from '../api/rooms.ts'
import { CATEGORIES, QUESTION_COUNT, shortName } from '../data/categories.ts'
import styles from './PlanetAnswers.module.css'

type Props = {
  token: string
  planetId: number
  ownerName: string
  planetName: string
}

type Pick = { code: string; n: number }

const sideOf = (bits: number, n: number) => ((bits >> n) & 1 ? 'b' : 'a')

// For the owner: one dot per question, filled where the friend answered the same way.
// Tapping a dot shows the question and both picks, from when the friend joined.
function PlanetAnswers({ token, planetId, ownerName, planetName }: Props) {
  const { data, isError, refetch } = useQuery({
    queryKey: ['planet', token, planetId],
    queryFn: () => fetchPlanet(token, planetId),
  })
  const [pick, setPick] = useState<Pick | null>(null)

  if (isError) {
    return (
      <button type="button" className={styles.retry} onClick={() => void refetch()}>
        답을 불러오지 못했어요 · 다시 시도
      </button>
    )
  }
  if (!data) return <div className={styles.loading} role="status" aria-label="답을 불러오는 중" />

  const same = data.categories.reduce((sum, c) => sum + c.matched, 0)
  const total = data.categories.length * QUESTION_COUNT
  const picked = pick ? data.categories.find((c) => c.code === pick.code) : undefined
  const category = pick ? CATEGORIES.find((c) => c.id === pick.code) : undefined
  const question = pick && category ? category.questions[pick.n] : undefined

  return (
    <div className={styles.answers}>
      <div className={styles.legend}>
        <span>
          <i className={`${styles.dot} ${styles.same}`} /> 같은 답 {same}
        </span>
        <span>
          <i className={`${styles.dot} ${styles.different}`} /> 다른 답 {total - same}
        </span>
      </div>

      <div className={styles.grid}>
        {data.categories.map((c) => {
          const cat = CATEGORIES.find((x) => x.id === c.code)
          const name = cat ? shortName(cat) : c.code
          return (
            <div key={c.code} className={styles.row}>
              <span className={styles.rowLabel} style={cat ? { color: cat.tint.fg } : undefined}>
                {name}
              </span>
              <span className={styles.dots}>
                {Array.from({ length: QUESTION_COUNT }, (_, n) => {
                  const isSame = sideOf(c.ownerBits, n) === sideOf(c.otherBits, n)
                  const active = pick?.code === c.code && pick.n === n
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.dot} ${isSame ? styles.same : styles.different} ${active ? styles.active : ''}`}
                      aria-label={`${name} ${n + 1}번, ${isSame ? '같은 답' : '다른 답'}`}
                      aria-pressed={active}
                      onClick={() => setPick(active ? null : { code: c.code, n })}
                    />
                  )
                })}
              </span>
            </div>
          )
        })}
      </div>

      <div className={styles.detail} aria-live="polite">
        {pick && picked && category && question ? (
          <>
            <div className={styles.question}>
              <span className={styles.qNo}>
                {shortName(category)} {pick.n + 1}번
              </span>
              {question.prompt}
            </div>
            {(
              [
                [ownerName, sideOf(picked.ownerBits, pick.n)],
                [planetName, sideOf(picked.otherBits, pick.n)],
              ] as const
            ).map(([who, side], i) => (
              <div key={i} className={styles.choiceRow}>
                <span className={styles.who}>{who}</span>
                <span className={`${styles.choice} ${side === 'a' ? styles.sideA : styles.sideB}`}>
                  {side === 'a' ? question.a : question.b}
                </span>
              </div>
            ))}
          </>
        ) : (
          <p className={styles.hint}>점을 누르면 어떤 질문이었는지, 둘이 뭘 골랐는지 보여요</p>
        )}
      </div>
    </div>
  )
}

export default PlanetAnswers
