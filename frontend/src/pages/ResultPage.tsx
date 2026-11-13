import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { fetchResult, HttpError, type ResultDto } from '../api/categories.ts'
import AdCard from '../components/AdCard.tsx'
import Icon from '../components/Icon.tsx'
import ResultHighlights from '../components/ResultHighlights.tsx'
import tier from '../components/tier.module.css'
import TopBar from '../components/TopBar.tsx'
import ui from '../components/ui.module.css'
import { findCategory, fromAnswerBits, toQuestion, type Category } from '../data/categories.ts'
import { withTopic } from '../lib/korean.ts'
import { ageGroupLabel, genderLabel } from '../lib/profile.ts'
import { exactRate, rarityOf, sameRatioLabel, type PickedChoice } from '../lib/rarity.ts'
import { clearAnswers } from '../store/testStore.ts'
import styles from './ResultPage.module.css'
import NotFoundPage from './NotFoundPage.tsx'

const DONUT_LENGTH = 2 * Math.PI * 34

function ResultPage() {
  const { catId } = useParams()
  const category = findCategory(catId)
  const query = useQuery({
    queryKey: ['result', category?.id],
    queryFn: () => fetchResult(category!.id),
    enabled: category != null,
    retry: (count, err) => !(err instanceof HttpError && err.status === 404) && count < 2,
  })
  if (!category) return <NotFoundPage />
  if (query.error instanceof HttpError && query.error.status === 404) {
    return <Navigate to={`/test/${category.id}`} replace />
  }
  if (query.isError) {
    return (
      <div className={`${ui.page} ${ui.status}`} role="alert">
        결과를 불러오지 못했어요
        <button type="button" className={ui.secondary} onClick={() => void query.refetch()}>
          다시 시도
        </button>
      </div>
    )
  }
  if (!query.data) {
    return (
      <div className={`${ui.page} ${ui.status}`} role="status">
        결과를 불러오는 중…
      </div>
    )
  }
  return <ResultView category={category} data={query.data} />
}

// How many people the donut stands for, beside it: the count stands out in the card's color.
function Count({ of, count, tone }: { of: number; count: number; tone: 'same' | 'apart' }) {
  return (
    <div className={styles.donutSide}>
      <span className={styles.donutOf}>{of.toLocaleString('ko-KR')}명 중</span>
      <b className={`${styles.donutCount} ${styles[tone]}`}>{count.toLocaleString('ko-KR')}명</b>
    </div>
  )
}

function Donut({ value, color, track }: { value: number; color: string; track: string }) {
  // tiny shares keep two decimals instead of showing 0.0%
  const label = value > 0 && value < 0.1 ? value.toFixed(2) : String(Math.round(value * 10) / 10)
  return (
    <div className={styles.donut}>
      <svg width="80" height="80" viewBox="0 0 84 84" aria-hidden>
        <circle cx="42" cy="42" r="34" fill="none" stroke={track} strokeWidth="9" />
        {value > 0 && (
          <circle
            cx="42"
            cy="42"
            r="34"
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * DONUT_LENGTH} ${DONUT_LENGTH}`}
          />
        )}
      </svg>
      <div className={styles.donutValue}>{label}%</div>
    </div>
  )
}

// blue for picks shared with many, coral for the rare ones, matching the stat cards above
function PickList({ title, picks, tone }: { title: string; picks: PickedChoice[]; tone: 'rare' | 'common' }) {
  return (
    <div className={`${ui.card} ${styles.top3}`}>
      <h2 className={ui.cardTitle}>{title}</h2>
      <ol className={`${styles.top3List} ${tone === 'common' ? styles.common : ''}`}>
        {picks.map((x, i) => (
          <li key={x.n} className={styles.top3Item}>
            <span className={`${styles.rank} ${i === 0 ? styles.rankFirst : ''}`}>{i + 1}</span>
            <div className={styles.top3Body}>
              <div className={styles.top3Row}>
                <span className={styles.top3Choice}>{x.choice}</span>
                <span className={styles.top3Rate}>{x.rate}%</span>
              </div>
              <div className={styles.top3Prompt}>{x.prompt}</div>
              <div className={styles.track}>
                <div className={styles.trackFill} style={{ width: `${Math.max(4, x.rate)}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function ResultView({ category, data }: { category: Category; data: ResultDto }) {
  const navigate = useNavigate()
  // the stat card whose explanation is open
  const [help, setHelp] = useState<number | null>(null)

  // tapping anywhere else closes the explanation
  useEffect(() => {
    if (help == null) return
    const close = () => setHelp(null)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [help])

  const id = category.id
  // the version the guest answered, which may differ from the category's current one
  const questions = data.questions.map(toQuestion)
  const answers = fromAnswerBits(data.answerBits)
  const result = rarityOf(questions, answers)
  const { overall } = data
  const profile = data.peer.profile
  const peer = data.peer.summary
  const peerRate = exactRate(peer)
  const overallRate = exactRate(overall)
  // the shares are of everyone but me
  const others = Math.max(0, overall.participants - 1)
  const differentRate = others > 0 ? (overall.different / others) * 100 : 0
  const fmt = (v: number) => v.toLocaleString('ko-KR')

  const retry = () => {
    clearAnswers(id)
    navigate(`/test/${id}/q/1`)
  }

  return (
    <div className={`${ui.page} ${styles.palette}`}>
      <TopBar title={`${category.name} 결과`} left={{ icon: 'home', label: '홈으로', onClick: () => navigate('/main') }} />

      <section className={`${styles.resultCard} ${tier[result.tone]}`} aria-label="결과 카드">
        <div className={styles.cardHead}>
          <span className={styles.lead}>내 {withTopic(category.name)}</span>
          <span className={styles.ratio}>{sameRatioLabel(overall)}</span>
        </div>
        <h1 className={styles.tier}>{result.tier}</h1>
        <div className={styles.headline}>{result.headline}</div>
        <div className={styles.minorityBox}>
          <div className={styles.minorityText}>
            {result.picks.length}문항 중 <b>{result.minority}개</b>는 소수 쪽 선택
          </div>
          <ol className={styles.dots} aria-hidden>
            {result.picks.map((p) => (
              <li key={p.n} className={p.rate < 50 ? styles.dotMinority : undefined} />
            ))}
          </ol>
        </div>
      </section>

      <ResultHighlights categoryId={id} questions={questions} picks={result.picks} show="contested" />

      <div className={styles.stats}>
        <div className={`${ui.card} ${styles.stat}`}>
          <button
            type="button"
            className={styles.statLabel}
            aria-expanded={help === 0}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setHelp(help === 0 ? null : 0)}
          >
            나와 취향이 비슷한 사람
          </button>
          {help === 0 && (
            <p className={styles.popover} role="tooltip" onPointerDown={(e) => e.stopPropagation()}>
              10문항 중 8개 이상 나와 같은 답을 고른 참여자 비율이에요.
            </p>
          )}
          <div className={styles.donutRow}>
            <Donut value={overall.similar} color="var(--same)" track="var(--same-soft)" />
            <Count of={others} count={overall.similarCount} tone="same" />
          </div>
        </div>
        <div className={`${ui.card} ${styles.stat}`}>
          <button
            type="button"
            className={styles.statLabel}
            aria-expanded={help === 1}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setHelp(help === 1 ? null : 1)}
          >
            나와 완전히 같은 사람
          </button>
          {help === 1 && (
            <p className={styles.popover} role="tooltip" onPointerDown={(e) => e.stopPropagation()}>
              10문항 답이 모두 나와 같은 참여자 비율이에요.
            </p>
          )}
          <div className={styles.donutRow}>
            <Donut value={overallRate} color="var(--same)" track="var(--same-soft)" />
            <Count of={others} count={overall.exact} tone="same" />
          </div>
        </div>
        <div className={`${ui.card} ${styles.stat}`}>
          <button
            type="button"
            className={styles.statLabel}
            aria-expanded={help === 2}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setHelp(help === 2 ? null : 2)}
          >
            나와 취향이 갈리는 사람
          </button>
          {help === 2 && (
            <p className={styles.popover} role="tooltip" onPointerDown={(e) => e.stopPropagation()}>
              10문항 중 같은 답이 2개 이하인 참여자 비율이에요.
            </p>
          )}
          <div className={styles.donutRow}>
            <Donut value={overall.opposite} color="var(--apart)" track="var(--apart-soft)" />
            <Count of={others} count={overall.oppositeCount} tone="apart" />
          </div>
        </div>
        <div className={`${ui.card} ${styles.stat}`}>
          <button
            type="button"
            className={styles.statLabel}
            aria-expanded={help === 3}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setHelp(help === 3 ? null : 3)}
          >
            나와 완전히 다른 사람
          </button>
          {help === 3 && (
            <p className={styles.popover} role="tooltip" onPointerDown={(e) => e.stopPropagation()}>
              10문항을 모두 나와 반대로 고른 참여자 비율이에요.
            </p>
          )}
          <div className={styles.donutRow}>
            <Donut value={differentRate} color="var(--apart)" track="var(--apart-soft)" />
            <Count of={others} count={overall.different} tone="apart" />
          </div>
        </div>
      </div>

      <div className={`${ui.card} ${styles.peer}`}>
        <span className={styles.peerLabel}>
          {ageGroupLabel(profile.ageGroup)} {genderLabel(profile.gender)} 중 나와 완전히 같은 사람
        </span>
        <div className={styles.peerValue}>
          <b>{peerRate.toFixed(2)}%</b>
          <span className={styles.peerCount}>
            {fmt(Math.max(0, peer.participants - 1))}명 중 {fmt(peer.exact)}명
          </span>
        </div>
        <div className={styles.statNote}>
          {peer.participants <= 1
            ? '아직 이 그룹에서 나 말고 참여한 사람이 없어요'
            : peerRate > overallRate
              ? '전체보다 또래 사이에 나와 같은 사람이 많아요'
              : peerRate < overallRate
                ? '전체보다 또래 사이에 나와 같은 사람이 적어요'
                : '전체와 또래 사이에서 나와 같은 사람의 비율이 같아요'}
        </div>
      </div>

      <PickList title="많은 사람이 고른 내 선택" picks={result.commonTop3} tone="common" />
      <PickList title="적은 사람만 고른 내 선택" picks={result.rareTop3} tone="rare" />
      <AdCard placement="RESULT_BANNER" categoryId={id} className={styles.ad} />
      <ResultHighlights categoryId={id} questions={questions} picks={result.picks} show="debate" />
      <p className={styles.note}>다른 참여자의 답은 결과에 바로 반영되지 않을 수 있어요.</p>

      <div className={styles.actions}>
        <button type="button" className={`${ui.primary} ${ui.large}`} onClick={() => navigate('/main')}>
          홈으로 가기
        </button>
        <div className={styles.subActions}>
          <button type="button" className={styles.subAction} onClick={() => navigate(`/result/${id}/detail`)}>
            <Icon name="query_stats" size={20} />
            자세한 결과
          </button>
          <button type="button" className={styles.subAction} onClick={retry}>
            <Icon name="replay" size={20} />
            다시 테스트
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResultPage
