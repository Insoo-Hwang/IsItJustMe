import { useQuery } from '@tanstack/react-query'
import { useState, type CSSProperties } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { fetchQuestionStats, HttpError, type GroupCountDto, type QuestionStatsDto } from '../api/categories.ts'
import TopBar from '../components/TopBar.tsx'
import ui from '../components/ui.module.css'
import { findCategory, fromAnswerBits, type Category } from '../data/categories.ts'
import { AGE_GROUPS, GENDERS, type AgeGroup, type Gender } from '../lib/profile.ts'
import styles from './ResultDetailPage.module.css'

const ALL = 'ALL'

type Filter<T> = T | typeof ALL

function ResultDetailPage() {
  const { catId } = useParams()
  const navigate = useNavigate()
  const category = findCategory(catId)
  const query = useQuery({
    // under 'result' so a profile change refreshes it with the result
    queryKey: ['result', category?.id, 'questions'],
    queryFn: () => fetchQuestionStats(category!.id),
    enabled: category != null,
    retry: (count, err) => !(err instanceof HttpError && err.status === 404) && count < 2,
  })
  if (!category) return <Navigate to="/main" replace />
  if (query.error instanceof HttpError && query.error.status === 404) {
    return <Navigate to={`/test/${category.id}`} replace />
  }

  return (
    <div
      className={ui.page}
      style={{ '--category': category.tint.fg, '--category-soft': category.tint.bg } as CSSProperties}
    >
      <TopBar
        title={`${category.name} 자세한 결과`}
        left={{ icon: 'arrow_back', label: '결과로', onClick: () => navigate(`/result/${category.id}`) }}
      />
      {query.isError ? (
        <div className={styles.status} role="alert">
          결과를 불러오지 못했어요
          <button type="button" className={ui.secondary} onClick={() => void query.refetch()}>
            다시 시도
          </button>
        </div>
      ) : query.data ? (
        <DetailView category={category} data={query.data} />
      ) : (
        <div className={styles.status} role="status">
          결과를 불러오는 중…
        </div>
      )}
    </div>
  )
}

function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: Filter<T>
  onChange: (value: Filter<T>) => void
}) {
  const all: { value: Filter<T>; label: string }[] = [{ value: ALL, label: '전체' }, ...options]
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {all.map((o) => (
        <button
          key={o.value}
          type="button"
          className={styles.chip}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function sum(groups: GroupCountDto[]): { option0: number; total: number } {
  return groups.reduce((acc, g) => ({ option0: acc.option0 + g.option0, total: acc.total + g.total }), {
    option0: 0,
    total: 0,
  })
}

function DetailView({ category, data }: { category: Category; data: QuestionStatsDto }) {
  const [gender, setGender] = useState<Filter<Gender>>(ALL)
  const [ageGroup, setAgeGroup] = useState<Filter<AgeGroup>>(ALL)
  const answers = fromAnswerBits(data.answerBits)
  const fmt = (v: number) => v.toLocaleString('ko-KR')

  return (
    <>
      <div className={`${ui.card} ${styles.filters}`}>
        <Chips label="성별" options={GENDERS} value={gender} onChange={setGender} />
        <Chips label="나이대" options={AGE_GROUPS} value={ageGroup} onChange={setAgeGroup} />
      </div>

      <ol className={styles.list} aria-label={`${category.name} 문항별 선택 비율`}>
        {data.questions.map((q, i) => {
          const { option0, total } = sum(
            q.groups.filter((g) => (gender === ALL || g.gender === gender) && (ageGroup === ALL || g.ageGroup === ageGroup)),
          )
          const rate0 = total > 0 ? Math.round((option0 / total) * 100) : 0
          const rows = [
            { label: q.option0, rate: rate0, mine: answers[i] === 'a' },
            { label: q.option1, rate: 100 - rate0, mine: answers[i] === 'b' },
          ]
          return (
            <li key={q.code} className={`${ui.card} ${styles.question}`}>
              <div className={styles.head}>
                <span className={styles.n}>Q{i + 1}</span>
                <span className={styles.prompt}>{q.prompt}</span>
              </div>
              {total === 0 ? (
                <div className={styles.empty}>아직 이 그룹의 응답이 없어요</div>
              ) : (
                <>
                  {rows.map((r) => (
                    <div key={r.label} className={`${styles.option} ${r.mine ? styles.mine : ''}`}>
                      <div className={styles.optionRow}>
                        <span className={styles.optionLabel}>
                          {r.label}
                          {r.mine && <span className={styles.myTag}>내 선택</span>}
                        </span>
                        <span className={styles.optionRate}>{r.rate}%</span>
                      </div>
                      <div className={styles.track}>
                        <div className={styles.fill} style={{ width: `${r.rate}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className={styles.total}>{fmt(total)}명 응답</div>
                </>
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}

export default ResultDetailPage
