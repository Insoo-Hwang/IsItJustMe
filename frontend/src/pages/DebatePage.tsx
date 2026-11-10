import { useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import Icon from '../components/Icon.tsx'
import TopBar from '../components/TopBar.tsx'
import ui from '../components/ui.module.css'
import { findCategory, type Choice } from '../data/categories.ts'
import story from '../data/story.ts'
import { fillDebate, parseDebate } from '../lib/debate.ts'
import { firstUnanswered, getTestState, setAnswer, useTestState } from '../store/testStore.ts'
import styles from './DebatePage.module.css'

const SIDES: Choice[] = ['a', 'b']

// A friend's pick on one question: take a side first, then see how everyone picked.
function DebatePage() {
  const navigate = useNavigate()
  const { catId, n } = useParams()
  const [search] = useSearchParams()
  const { results } = useTestState()
  const [mine, setMine] = useState<Choice | null>(null)

  const category = findCategory(catId)
  const question = category?.questions[Number(n) - 1]
  const debate = parseDebate(search)
  if (!category || !question || !debate) return <Navigate to="/main" replace />

  const { name, pick } = debate
  const d = story.debate
  const rateOf = (c: Choice) => (c === 'a' ? question.aRate : 100 - question.aRate)
  const label = (c: Choice) => (c === 'a' ? question.a : question.b)
  const values = (c: Choice) => ({ name, prompt: question.prompt, choice: label(pick), rate: rateOf(c) })
  const done = results[category.id] != null

  // The side taken here is also the answer to this question in the test that follows.
  const take = (c: Choice) => {
    setMine(c)
    if (!done) setAnswer(category.id, Number(n) - 1, c)
  }
  const startTest = () => {
    const next = firstUnanswered(getTestState().answers[category.id])
    navigate(`/test/${category.id}/q/${(next < 0 ? 0 : next) + 1}`)
  }

  return (
    <div className={ui.page}>
      <TopBar title={d.title} left={{ icon: 'home', label: '홈으로', onClick: () => navigate('/main') }} />

      <section className={`${ui.card} ${styles.card}`} aria-label={d.title}>
        <div className={styles.head}>
          <span className={styles.badge}>🔥 {d.title}</span>
          <span className={styles.category}>{category.name}</span>
        </div>
        <h1 className={styles.prompt}>{question.prompt}</h1>
        <p className={styles.taunt}>{fillDebate(d.taunt, values(pick))}</p>

        {mine == null ? (
          <>
            <p className={styles.question}>{d.question}</p>
            <div className={styles.options}>
              {SIDES.map((c) => (
                <button key={c} type="button" className={styles.option} onClick={() => take(c)}>
                  {label(c)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <ul className={styles.bars}>
              {SIDES.map((c) => (
                <li key={c} className={c === mine ? styles.mine : undefined}>
                  <div className={styles.barHead}>
                    <span className={styles.barLabel}>
                      {label(c)}
                      {c === pick && <span className={styles.tag}>{name}</span>}
                      {c === mine && <span className={`${styles.tag} ${styles.me}`}>나</span>}
                    </span>
                    <span className={styles.barRate}>{Math.round(rateOf(c))}%</span>
                  </div>
                  <div className={styles.track}>
                    <span style={{ width: `${rateOf(c)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {mine != null && (
        <div className={styles.actions}>
          <button
            type="button"
            className={`${ui.primary} ${ui.large}`}
            onClick={() => (done ? navigate(`/result/${category.id}`) : startTest())}
          >
            {done ? `내 ${category.name} 결과 보기` : d.testButton}
            <Icon name="arrow_forward" size={20} />
          </button>
          <button type="button" className={styles.again} onClick={() => setMine(null)}>
            다시 고르기
          </button>
        </div>
      )}
    </div>
  )
}

export default DebatePage
