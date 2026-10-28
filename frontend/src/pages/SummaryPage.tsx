import { Navigate, useNavigate } from 'react-router'
import Icon from '../components/Icon.tsx'
import RarityHexagon from '../components/RarityHexagon.tsx'
import tier from '../components/tier.module.css'
import TopBar from '../components/TopBar.tsx'
import ui from '../components/ui.module.css'
import { useSummary } from '../lib/summary.ts'
import styles from './SummaryPage.module.css'

const fmt = (n: number) => n.toLocaleString('ko-KR')

// Overall rarity report across every category. Open only after all of them are done.
function SummaryPage() {
  const navigate = useNavigate()
  const state = useSummary()
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

  const { rows, picks, minority, tier: overall, overall: summary } = state.summary
  const axes = rows.map(({ category, rarity }) => ({
    label: category.name.replace(/ 취향$/, ''),
    value: rarity.picks.length > 0 ? rarity.minority / rarity.picks.length : 0,
  }))

  return (
    <div className={`${ui.page} ${tier[overall.tone]}`}>
      {top}

      <section className={styles.hero} aria-label="종합 결과">
        <div className={styles.eyebrow}>FINAL RARITY REPORT</div>
        <div className={styles.lead}>나의 희귀도 보고서</div>
        <h1 className={styles.tier}>{overall.tier}</h1>
        <div className={styles.headline}>{overall.headline}</div>
        <div className={styles.count}>
          {picks}문항 중 <b>{minority}개</b>를 소수 쪽으로 골랐어요
        </div>
      </section>

      <div className={styles.metrics}>
        <div className={`${ui.card} ${styles.metric}`}>
          <div className={styles.metricValue}>
            {summary.similar}
            <small>%</small>
          </div>
          <div className={styles.metricLabel}>유사 취향 비율</div>
        </div>
        <div className={`${ui.card} ${styles.metric}`}>
          <div className={styles.metricValue}>
            {fmt(summary.exact)}
            <small>명</small>
          </div>
          <div className={styles.metricLabel}>완전 일치</div>
        </div>
        <div className={`${ui.card} ${styles.metric}`}>
          <div className={styles.metricValue}>
            {minority}
            <small>개</small>
          </div>
          <div className={styles.metricLabel}>소수 선택</div>
        </div>
      </div>
      <p className={styles.note}>
        유사 취향은 {picks}문항 중 80% 이상 같은 사람이에요. 6개 테스트를 모두 끝낸 {fmt(summary.participants)}명 기준
        잠정 결과예요.
      </p>

      <section className={`${ui.card} ${styles.chartCard}`} aria-label="카테고리별 희귀도">
        <h2 className={ui.cardTitle}>카테고리별 소수 선택 비율</h2>
        <RarityHexagon axes={axes} />
      </section>

      <ul className={styles.list}>
        {rows.map(({ category, rarity, ratio }) => (
          <li key={category.id}>
            <button type="button" className={`${ui.card} ${styles.row}`} onClick={() => navigate(`/result/${category.id}`)}>
              <span className={styles.icon} style={{ background: category.tint.bg, color: category.tint.fg }}>
                <Icon name={category.icon} size={24} />
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

      <section className={styles.teaser} aria-label="마지막 비교 대상">
        <div className={styles.teaserMark} aria-hidden>
          ?
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
