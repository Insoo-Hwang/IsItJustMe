import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import Icon from '../components/Icon.tsx'
import RarityHexagon from '../components/RarityHexagon.tsx'
import ShareUniverseButton from '../components/ShareUniverseButton.tsx'
import TasteCard from '../components/TasteCard.tsx'
import tier from '../components/tier.module.css'
import TopBar from '../components/TopBar.tsx'
import ui from '../components/ui.module.css'
import { shortName } from '../data/categories.ts'
import { minorityShare, rankLineOf } from '../lib/rarity.ts'
import { useSummary } from '../lib/summary.ts'
import styles from './SummaryPage.module.css'

const fmt = (n: number) => n.toLocaleString('ko-KR')

// Overall rarity report across every category. Open only after all of them are done.
function SummaryPage() {
  const navigate = useNavigate()
  const state = useSummary()
  const [help, setHelp] = useState<number | null>(null)

  // tapping anywhere else closes the metric popover
  useEffect(() => {
    if (help == null) return
    const close = () => setHelp(null)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [help])
  if (state.status === 'locked') return <Navigate to="/main" replace />
  if (state.status === 'missing') return <Navigate to={`/test/${state.categoryId}`} replace />

  const top = <TopBar title="종합 결과" left={{ icon: 'home', label: '홈으로', onClick: () => navigate('/main') }} />
  if (state.status === 'error') {
    return (
      <div className={ui.page}>
        {top}
        <div className={styles.status} role="alert">
          결과를 불러오지 못했어요
          <button type="button" className={ui.secondary} onClick={state.retry}>
            다시 시도
          </button>
        </div>
      </div>
    )
  }
  if (state.status === 'loading') {
    return (
      <div className={ui.page}>
        {top}
        <div className={styles.status} role="status">
          결과를 모으는 중…
        </div>
      </div>
    )
  }

  const { rows, picks, minority, tier: overall, overall: summary, questions, averageMatch, topPercent } = state.summary
  const axes = rows.map(({ category, rarity }) => ({
    label: shortName(category),
    value: minorityShare(rarity),
  }))
  const rarest = rows
    .flatMap(({ rarity }) => rarity.picks)
    .reduce((min, p) => (p.rate < min.rate ? p : min))
  const card = {
    tier: overall.tier,
    tone: overall.tone,
    headline: overall.headline,
    topPercent,
    rankLine: topPercent == null ? null : rankLineOf(topPercent),
    minority,
    picks,
    averageMatch,
    exact: summary.exact,
    axes,
    categories: rows.map(({ category, rarity }) => ({ name: category.name, tier: rarity.tier })),
    rarest: { prompt: rarest.prompt, choice: rarest.choice, rate: Math.round(rarest.rate) },
  }
  const metrics = [
    { label: '유사 취향 비율', value: summary.similar, unit: '%', help: `유사 취향은 ${picks}문항 중 80% 이상 같은 사람이에요.` },
    { label: '완전 일치', value: fmt(summary.exact), unit: '명', help: `${picks}문항 답이 모두 나와 같은 사람 수예요.` },
    { label: '소수 선택', value: minority, unit: '개', help: `${picks}문항 중 더 적은 사람이 고른 쪽을 고른 수예요.` },
  ]

  return (
    <div className={`${ui.page} ${tier[overall.tone]}`}>
      {top}

      <section className={styles.hero} aria-label="종합 결과">
        <div className={styles.lead}>나의 취향 보고서</div>
        <h1 className={styles.tier}>{overall.tier}</h1>
        <div className={styles.headline}>{overall.headline}</div>
        <div className={styles.count}>
          {picks}문항 중 <b>{minority}개</b>를 소수 쪽으로 골랐어요
        </div>
      </section>

      {topPercent != null && (
        <section className={`${ui.card} ${styles.rank}`} aria-label="소수파 순위">
          <div className={styles.rankLead}>내 희귀도는</div>
          <div className={styles.rankValue}>
            상위 <b>{topPercent}%</b>
          </div>
          <p className={styles.rankText}>{rankLineOf(topPercent)}</p>
          <div className={styles.rankTrack} aria-hidden>
            <span style={{ left: `${topPercent}%` }} />
          </div>
          <div className={styles.rankEnds} aria-hidden>
            <span>더 희귀한 편</span>
            <span>더 흔한 편</span>
          </div>
        </section>
      )}

      <section className={styles.compare} aria-label={`${fmt(summary.participants)}명과 비교해본 나`}>
        <h2 className={styles.compareTitle}>{fmt(summary.participants)}명과 비교해본 나</h2>
        <div className={styles.metrics}>
          {metrics.map((metric, i) => (
            <div key={metric.label} className={`${ui.card} ${styles.metric}`}>
              <div className={styles.metricValue}>
                {metric.value}
                <small>{metric.unit}</small>
              </div>
              <button
                type="button"
                className={styles.metricLabel}
                aria-expanded={help === i}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setHelp(help === i ? null : i)}
              >
                {metric.label}
              </button>
              {help === i && (
                <p className={styles.popover} role="tooltip" onPointerDown={(e) => e.stopPropagation()}>
                  {metric.help}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={`${ui.card} ${styles.average}`} aria-label="다른 사람들과 평균 취향 일치율">
        <div className={styles.averageLabel}>다른 사람들과 평균 취향 일치율</div>
        {averageMatch == null ? (
          <p className={styles.averageEmpty}>아직 비교할 참여자가 없어요</p>
        ) : (
          <>
            <div className={styles.averageValue}>
              {averageMatch.toFixed(1)}
              <small>%</small>
            </div>
            <div className={styles.averageTrack} aria-hidden>
              <span style={{ width: `${averageMatch}%` }} />
            </div>
            <p className={styles.averageText}>
              다른 참여자들과 {questions}개 문항 중 평균 <b>{Math.round((averageMatch / 100) * questions)}개</b> 정도의
              선택이 같아요.
            </p>
          </>
        )}
      </section>

      <section className={`${ui.card} ${styles.chartCard}`} aria-label="카테고리별 희귀도">
        <h2 className={ui.cardTitle}>카테고리별 소수 선택 비율</h2>
        <RarityHexagon axes={axes} />
      </section>

      <ul className={styles.list}>
        {rows.map(({ category, rarity, ratio }) => (
          <li key={category.id}>
            <button type="button" className={styles.row} onClick={() => navigate(`/result/${category.id}`)}>
              <span className={styles.icon} style={{ background: category.tint.bg, color: category.tint.fg }}>
                <Icon name={category.icon} size={22} filled />
              </span>
              <span className={styles.rowText}>
                <span className={styles.rowName}>{category.name}</span>
                <span className={styles.rowRatio}>{ratio}</span>
              </span>
              <span className={`${styles.chip} ${tier[rarity.tone]}`}>{rarity.tier}</span>
              <Icon name="chevron_right" size={20} className={styles.chevron} />
            </button>
          </li>
        ))}
      </ul>

      <TasteCard data={card} />

      <section className={`${ui.card} ${styles.share}`} aria-label="친구와 비교">
        <div>
          <p className={styles.shareText}>친구들은 나랑 얼마나 다를까?</p>
          <p className={styles.shareSub}>공유하면 친구들이 모인 내 취향 우주를 볼 수 있어.</p>
        </div>
        <ShareUniverseButton className={`${ui.primary} ${ui.large} ${styles.shareButton}`}>
          공유하기
        </ShareUniverseButton>
      </section>

      <section className={styles.teaser} aria-label="마지막 비교 대상">
        <div className={styles.teaserMark} aria-hidden>
          <Icon name="question_mark" size={26} />
        </div>
        <p className={styles.teaserText}>
          그런데 아직 비교하지 못한 사람이
          <br />한 명 남았어.
        </p>
        <button type="button" className={`${ui.dark} ${styles.teaserButton}`} onClick={() => navigate('/ending')}>
          마지막 비교 대상 만나기
          <Icon name="arrow_forward" size={20} />
        </button>
      </section>
    </div>
  )
}

export default SummaryPage
