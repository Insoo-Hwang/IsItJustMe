import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams } from 'react-router'
import { fetchResult, HttpError, type ResultDto } from '../api/categories.ts'
import Icon from '../components/Icon.tsx'
import TopBar from '../components/TopBar.tsx'
import ui from '../components/ui.module.css'
import { findCategory, fromAnswerBits, toQuestion, type Category } from '../data/categories.ts'
import { withTopic } from '../lib/korean.ts'
import { ageGroupLabel, genderLabel } from '../lib/profile.ts'
import { fromSummary } from '../lib/rarity.ts'
import { showToast } from '../lib/toast.ts'
import { clearAnswers } from '../store/testStore.ts'
import styles from './ResultPage.module.css'

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
  if (!category) return <Navigate to="/main" replace />
  if (query.error instanceof HttpError && query.error.status === 404) {
    return <Navigate to={`/test/${category.id}`} replace />
  }
  if (query.isError) {
    return (
      <div className={`${ui.page} ${styles.status}`} role="alert">
        결과를 불러오지 못했어요
        <button type="button" className={ui.secondary} onClick={() => void query.refetch()}>
          다시 시도
        </button>
      </div>
    )
  }
  if (!query.data) {
    return (
      <div className={`${ui.page} ${styles.status}`} role="status">
        결과를 불러오는 중…
      </div>
    )
  }
  return <ResultView category={category} data={query.data} />
}

function ResultView({ category, data }: { category: Category; data: ResultDto }) {
  const navigate = useNavigate()

  const id = category.id
  // the version the guest answered, which may differ from the category's current one
  const questions = data.questions.map(toQuestion)
  const answers = fromAnswerBits(data.answerBits)
  const result = fromSummary(questions, answers, data.overall)
  const rare = result.rareTop3[0]
  const profile = data.peer.profile
  const peer = fromSummary(questions, answers, data.peer.summary)
  const fmt = (v: number) => v.toLocaleString('ko-KR')

  const retry = () => {
    clearAnswers(id)
    navigate(`/test/${id}/q/1`)
  }

  return (
    <div className={ui.page}>
      <TopBar
        title={`${category.name} 결과`}
        left={{ icon: 'home', label: '홈으로', onClick: () => navigate('/main') }}
        right={{ icon: 'bar_chart', label: `${category.name} 통계`, onClick: () => navigate(`/stats/${id}`) }}
      />

      <section className={styles.resultCard} aria-label="결과 카드">
        <span className={styles.deco} style={{ right: -50, top: -50, width: 180, height: 180, background: 'var(--coral-light)' }} />
        <span className={styles.deco} style={{ right: 40, top: 96, width: 26, height: 26, background: 'var(--butter-deep)' }} />
        <span
          className={styles.deco}
          style={{ left: -30, bottom: -60, width: 140, height: 140, boxShadow: 'inset 0 0 0 2px oklch(0.78 0.1 28)' }}
        />
        <div className={styles.cardHead}>
          <span className={styles.brand}>나의 희귀도 테스트</span>
          <span className={styles.ratio}>100명 중 {result.top}명</span>
        </div>
        <div className={styles.lead}>내 {withTopic(category.name)}</div>
        <h1 className={styles.tier}>{result.tier}</h1>
        <div className={styles.headline}>{result.headline}</div>
        <div className={styles.rareBox}>
          <div className={styles.rareLabel}>가장 희귀한 내 선택</div>
          <div className={styles.rareRow}>
            <span className={styles.rareChoice}>
              {rare.prompt} {rare.choice}
            </span>
            <span className={styles.rareRate}>{rare.rate}%만 선택</span>
          </div>
        </div>
      </section>

      <div className={styles.stats}>
        <div className={`${ui.card} ${styles.stat}`}>
          <div className={styles.statLabel}>나와 비슷한 사람</div>
          <div className={styles.donut}>
            <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden>
              <circle cx="42" cy="42" r="34" fill="none" stroke="var(--blue-soft)" strokeWidth="12" />
              <circle
                cx="42"
                cy="42"
                r="34"
                fill="none"
                stroke="var(--blue)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(result.similar / 100) * DONUT_LENGTH} ${DONUT_LENGTH}`}
              />
            </svg>
            <div className={styles.donutValue}>{result.similar}%</div>
          </div>
          <div className={styles.statNote}>
            답변이 80% 이상
            <br />
            일치하는 참여자
          </div>
        </div>
        <div className={`${ui.card} ${styles.stat}`}>
          <div className={styles.statLabel}>나와 완전히 같은 사람</div>
          <div className={styles.exact}>
            <span className={styles.exactValue}>{fmt(result.exact)}</span>
            <span className={styles.exactUnit}>명</span>
          </div>
          <div className={styles.statNote}>
            {result.exact === 0 ? '세상에 하나뿐인 조합이에요' : `${fmt(data.overall.participants)}명 중 ${fmt(result.exact)}명`}
          </div>
        </div>
      </div>

      <div className={`${ui.card} ${styles.peer}`}>
        <div className={styles.peerHead}>
          <span className={styles.peerLabel}>
            {ageGroupLabel(profile.ageGroup)} {genderLabel(profile.gender)} 중에서는
          </span>
          <span className={styles.peerTier}>{peer.tier}</span>
        </div>
        <div className={styles.peerValue}>
          100명 중 <b>{peer.top}</b>명
        </div>
        <div className={styles.statNote}>
          {peer.top < result.top
            ? '전체보다 또래 사이에서 더 희귀해요'
            : peer.top > result.top
              ? '또래 사이에서는 덜 희귀한 편이에요'
              : '전체와 또래 사이에서 희귀한 정도가 같아요'}
        </div>
      </div>

      <div className={`${ui.card} ${styles.top3}`}>
        <h2 className={ui.cardTitle}>가장 희귀한 내 선택 TOP 3</h2>
        <ol className={styles.top3List}>
          {result.rareTop3.map((x, i) => (
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

      <button
        type="button"
        className={styles.compareCta}
        onClick={() => showToast('준비 중이에요')}
      >
        <span className={styles.circles} aria-hidden />
        <span className={styles.ctaText}>
          <span className={styles.ctaTitle}>친구는 나랑 얼마나 같을까?</span>
          <span className={styles.ctaSub}>
            링크를 보내면 한 문항씩 비교할 수 있어요
          </span>
        </span>
        <Icon name="chevron_right" />
      </button>

      <div className={styles.subActions}>
        <button type="button" className={styles.subAction} onClick={retry}>
          <Icon name="replay" size={20} />
          다시 테스트
        </button>
        <button type="button" className={styles.subAction} onClick={() => navigate('/main#categories')}>
          <Icon name="grid_view" size={20} />
          다른 카테고리
        </button>
      </div>

      <div className={ui.spacer} />
      <div className={ui.stickyBottom}>
        <button type="button" className={`${ui.primary} ${ui.large}`} onClick={() => showToast('준비 중이에요')}>
          <Icon name="ios_share" size={22} />
          친구에게 공유하기
        </button>
      </div>
    </div>
  )
}

export default ResultPage
