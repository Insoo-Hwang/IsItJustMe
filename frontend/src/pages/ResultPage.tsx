import { useQuery } from '@tanstack/react-query'
import { Navigate, useNavigate, useParams } from 'react-router'
import { fetchResult, HttpError, type ResultDto } from '../api/categories.ts'
import Icon from '../components/Icon.tsx'
import TopBar from '../components/TopBar.tsx'
import ui from '../components/ui.module.css'
import { findCategory, fromAnswerBits, toQuestion, type Category } from '../data/categories.ts'
import { withTopic } from '../lib/korean.ts'
import { ageGroupLabel, genderLabel } from '../lib/profile.ts'
import { exactRate, rarityOf, sameRatioLabel, type PickedChoice } from '../lib/rarity.ts'
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

function Donut({ value, color, track }: { value: number; color: string; track: string }) {
  return (
    <div className={styles.donut}>
      <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden>
        <circle cx="42" cy="42" r="34" fill="none" stroke={track} strokeWidth="12" />
        {value > 0 && (
          <circle
            cx="42"
            cy="42"
            r="34"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * DONUT_LENGTH} ${DONUT_LENGTH}`}
          />
        )}
      </svg>
      <div className={styles.donutValue}>{value}%</div>
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

  const id = category.id
  // the version the guest answered, which may differ from the category's current one
  const questions = data.questions.map(toQuestion)
  const answers = fromAnswerBits(data.answerBits)
  const result = rarityOf(questions, answers)
  const rare = result.rareTop3[0]
  const { overall } = data
  const profile = data.peer.profile
  const peer = data.peer.summary
  const peerRate = exactRate(peer)
  const overallRate = exactRate(overall)
  const fmt = (v: number) => v.toLocaleString('ko-KR')

  const retry = () => {
    clearAnswers(id)
    navigate(`/test/${id}/q/1`)
  }

  return (
    <div className={`${ui.page} ${styles.palette}`}>
      <TopBar title={`${category.name} 결과`} left={{ icon: 'home', label: '홈으로', onClick: () => navigate('/main') }} />

      <section className={`${styles.resultCard} ${styles[`tier-${result.tone}`]}`} aria-label="결과 카드">
        <span className={styles.deco} style={{ right: -50, top: -50, width: 180, height: 180, background: 'var(--tier-light)' }} />
        <span className={styles.deco} style={{ right: 40, top: 96, width: 26, height: 26, background: 'var(--butter-deep)' }} />
        <span
          className={styles.deco}
          style={{ left: -30, bottom: -60, width: 140, height: 140, boxShadow: 'inset 0 0 0 2px var(--tier-light)' }}
        />
        <div className={styles.cardHead}>
          <span className={styles.ratio}>{sameRatioLabel(overall)}</span>
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
          <div className={styles.statLabel}>나와 취향이 비슷한 사람</div>
          <Donut value={overall.similar} color="var(--same)" track="var(--same-soft)" />
          <div className={styles.statNote}>
            답변이 8개 이상
            <br />
            일치하는 참여자
          </div>
        </div>
        <div className={`${ui.card} ${styles.stat}`}>
          <div className={styles.statLabel}>나와 완전히 같은 사람</div>
          <div className={`${styles.exact} ${styles.same}`}>
            <span className={styles.exactValue}>{fmt(overall.exact)}</span>
            <span className={styles.exactUnit}>명</span>
          </div>
          <div className={styles.statNote}>
            {overall.exact === 0 ? '세상에 하나뿐인 조합이에요' : `${fmt(overall.participants)}명 중 ${fmt(overall.exact)}명`}
          </div>
        </div>
        <div className={`${ui.card} ${styles.stat}`}>
          <div className={styles.statLabel}>나와 취향이 갈리는 사람</div>
          <Donut value={overall.opposite} color="var(--apart)" track="var(--apart-soft)" />
          <div className={styles.statNote}>
            답변이 2개 이하로
            <br />
            일치하는 참여자
          </div>
        </div>
        <div className={`${ui.card} ${styles.stat}`}>
          <div className={styles.statLabel}>나와 완전히 다른 사람</div>
          <div className={`${styles.exact} ${styles.apart}`}>
            <span className={styles.exactValue}>{fmt(overall.different)}</span>
            <span className={styles.exactUnit}>명</span>
          </div>
          <div className={styles.statNote}>
            {overall.different === 0 ? '정반대인 사람은 아직 없어요' : '10문항 모두 반대로 고른 사람'}
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

      <PickList title="가장 흔한 내 선택 TOP 3" picks={result.commonTop3} tone="common" />
      <PickList title="가장 희귀한 내 선택 TOP 3" picks={result.rareTop3} tone="rare" />

      <div className={styles.actions}>
        <button type="button" className={`${ui.primary} ${ui.large}`} onClick={() => showToast('준비 중이에요')}>
          <Icon name="ios_share" size={22} />
          친구에게 공유하기
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
