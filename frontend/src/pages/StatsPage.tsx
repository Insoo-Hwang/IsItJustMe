import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import Icon from '../components/Icon.tsx'
import ui from '../components/ui.module.css'
import { CATEGORIES, findCategory, type Choice, type Question } from '../data/categories.ts'
import { groupRate } from '../lib/demographics.ts'
import { AGE_GROUPS, GENDERS, type AgeGroup, type Gender } from '../lib/profile.ts'
import { useTestState } from '../store/testStore.ts'
import styles from './StatsPage.module.css'

type View = 'all' | 'age' | 'gender'

const VIEWS: { value: View; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'age', label: '나이대별' },
  { value: 'gender', label: '성별' },
]

function OverallBar({ question, pick }: { question: Question; pick: Choice | null }) {
  return (
    <div className={`${styles.split} ${pick ? styles.answered : ''}`}>
      <div
        className={`${styles.side} ${styles.sideA} ${pick === 'a' ? styles.mine : ''}`}
        style={{ width: `calc(${question.aRate}% - 2px)` }}
      >
        <span className={styles.sideLabel}>{question.a}</span>
        <span>{question.aRate}%</span>
      </div>
      <div className={`${styles.side} ${styles.sideB} ${pick === 'b' ? styles.mine : ''}`}>
        <span>{100 - question.aRate}%</span>
        <span className={styles.sideLabel}>{question.b}</span>
      </div>
    </div>
  )
}

type Group = { value: AgeGroup | Gender; label: string }

function GroupBars({ question, groups, myGroup }: { question: Question; groups: Group[]; myGroup?: string }) {
  return (
    <div className={styles.groups}>
      <div className={styles.legend}>
        <span className={styles.legendA}>A {question.a}</span>
        <span className={styles.legendB}>B {question.b}</span>
      </div>
      {groups.map((g) => {
        const rate = groupRate(question, g.value)
        const isMine = g.value === myGroup
        return (
          <div key={g.value} className={`${styles.groupRow} ${isMine ? styles.myGroup : ''}`}>
            <span className={styles.groupLabel}>
              {g.label}
              {isMine && <span className={styles.meDot}>나</span>}
            </span>
            <div className={styles.groupBar}>
              <span className={styles.groupA} style={{ width: `${rate}%` }}>
                {rate}%
              </span>
              <span className={styles.groupB}>{100 - rate}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatsPage() {
  const { catId } = useParams()
  const navigate = useNavigate()
  const { answers, results, profile } = useTestState()
  const [view, setView] = useState<View>('all')
  const category = catId ? findCategory(catId) : CATEGORIES[0]
  if (!category) return <Navigate to="/stats" replace />

  // Prefer the finished result; fall back to answers given so far.
  const mine = results[category.id]?.answers ?? answers[category.id] ?? []
  const hasAny = mine.some((c) => c != null)

  const note =
    view === 'all'
      ? hasAny
        ? '내 선택은 진하게 표시돼요'
        : '테스트를 하면 내 선택이 표시돼요'
      : profile
        ? '내가 속한 그룹은 진하게 표시돼요'
        : '테스트를 마치면 내 그룹이 표시돼요'

  return (
    <div className={styles.stats}>
      <div className={styles.head}>
        <h1 className={styles.title}>취향 통계</h1>
        <p className={styles.sub}>다른 사람들은 뭘 골랐을까?</p>
      </div>
      <div className={styles.chips} aria-label="카테고리">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.id === category.id}
            className={`${styles.chip} ${c.id === category.id ? styles.chipActive : ''}`}
            onClick={() => navigate(`/stats/${c.id}`, { replace: true })}
          >
            <Icon name={c.icon} size={17} />
            {c.name}
          </button>
        ))}
      </div>
      <div className={styles.body}>
        <div className={styles.summary}>
          <div>
            <div className={styles.summaryLabel}>{category.name} 참여자</div>
            <div className={styles.summaryValue}>{category.participants.toLocaleString('ko-KR')}명</div>
          </div>
          <div className={styles.summaryNote}>{note}</div>
        </div>
        <div className={styles.views} aria-label="보기 방식">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              aria-pressed={view === v.value}
              className={`${styles.view} ${view === v.value ? styles.viewActive : ''}`}
              onClick={() => setView(v.value)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <ol className={styles.rows}>
          {category.questions.map((q, i) => {
            const pick = mine[i] ?? null
            return (
              <li key={q.id} className={`${ui.card} ${styles.row}`}>
                <div className={styles.rowHead}>
                  <span className={styles.prompt}>
                    <span className={styles.qNum}>Q{i + 1}</span>
                    {q.prompt}
                  </span>
                  {pick && <span className={styles.mineTag}>내 선택: {q[pick]}</span>}
                </div>
                {view === 'all' && <OverallBar question={q} pick={pick} />}
                {view === 'age' && <GroupBars question={q} groups={AGE_GROUPS} myGroup={profile?.ageGroup} />}
                {view === 'gender' && <GroupBars question={q} groups={GENDERS} myGroup={profile?.gender} />}
              </li>
            )
          })}
        </ol>
      </div>
      <div style={{ height: 24 }} />
    </div>
  )
}

export default StatsPage
