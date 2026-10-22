import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import Icon from '../components/Icon.tsx'
import ShareSheet from '../components/sheets/ShareSheet.tsx'
import TopBar from '../components/TopBar.tsx'
import ui from '../components/ui.module.css'
import { useSheet } from '../hooks/useSheet.ts'
import { withTopic } from '../lib/korean.ts'
import { analyze, compare } from '../lib/rarity.ts'
import { parseShareId, toShareId } from '../lib/share.ts'
import { setPendingCompare, useTestState } from '../store/testStore.ts'
import styles from './ComparePage.module.css'

const FRIEND = '친구'

function ComparePage() {
  const { shareId } = useParams()
  const navigate = useNavigate()
  const share = useSheet('share')
  const { results } = useTestState()
  const shared = parseShareId(shareId)
  const sharedCatId = shared?.category.id
  const mine = sharedCatId ? results[sharedCatId] : undefined
  const isOwnLink = sharedCatId != null && mine != null && toShareId(sharedCatId, mine.answers) === shareId

  // Remember the friend so the result page can come back here after the test.
  useEffect(() => {
    if (sharedCatId && shareId && !isOwnLink) setPendingCompare(sharedCatId, shareId)
  }, [sharedCatId, shareId, isOwnLink])

  if (!shared) {
    return (
      <div className={ui.page}>
        <TopBar title="친구와 비교" left={{ icon: 'home', label: '홈으로', onClick: () => navigate('/main') }} />
        <div className={ui.empty}>
          <Icon name="link_off" size={40} />
          링크가 올바르지 않아요
          <button type="button" className={`${ui.primary} ${ui.inline}`} onClick={() => navigate('/main')}>
            테스트 둘러보기
          </button>
        </div>
      </div>
    )
  }

  const { category, answers: theirs } = shared
  const id = category.id
  // Opening my own link: nothing to compare, offer to send it instead.
  if (isOwnLink) return <Navigate to={`/result/${id}?sheet=share`} replace />

  const banner = (
    <div className={styles.banner}>
      <Icon name="link" size={18} />
      {FRIEND}가 보낸 {category.name} 링크로 들어왔어요
    </div>
  )

  if (!mine) {
    const friendResult = analyze(category, theirs)
    const start = () => navigate(`/test/${id}`)
    return (
      <div className={ui.page}>
        <TopBar title="친구와 비교" left={{ icon: 'home', label: '홈으로', onClick: () => navigate('/main') }} />
        {banner}
        <section className={styles.invite}>
          <div className={styles.inviteLead}>
            {FRIEND}의 {withTopic(category.name)}
          </div>
          <div className={styles.inviteTier}>{friendResult.tier}</div>
          <div className={styles.inviteSub}>{friendResult.headline}</div>
        </section>
        <p className={styles.inviteBody}>
          나도 {category.questions.length}문항에 답하면
          <br />
          {FRIEND}와 몇 % 같은지 바로 볼 수 있어요.
        </p>
        <div className={ui.spacer} />
        <div className={ui.stickyBottom}>
          <button type="button" className={`${ui.primary} ${ui.large}`} onClick={start}>
            나도 테스트하고 비교하기
          </button>
        </div>
      </div>
    )
  }

  const myResult = analyze(category, mine.answers)
  const result = compare(category, mine.answers, theirs)

  return (
    <div className={ui.page}>
      <TopBar
        title="친구와 비교"
        left={{ icon: 'arrow_back', label: '내 결과로', onClick: () => navigate(`/result/${id}`) }}
      />
      {banner}
      <div className={styles.venn} aria-hidden>
        <div className={`${styles.circle} ${styles.circleMe}`} />
        <div className={`${styles.circle} ${styles.circleFriend}`} />
        <div className={`${styles.vennLabel} ${styles.labelMe}`}>나</div>
        <div className={`${styles.vennLabel} ${styles.labelFriend}`}>{FRIEND}</div>
        <div className={styles.match}>
          <div className={styles.matchValue}>{result.matchRate}%</div>
          <div className={styles.matchLabel}>일치</div>
        </div>
      </div>
      <div className={styles.summary}>
        <h1 className={styles.title}>{result.title}</h1>
        <div className={styles.counts}>
          같은 답 {result.same.length}개 · 다른 답 {result.diff.length}개
        </div>
      </div>
      <div className={styles.meter}>
        <div className={styles.meterFill} style={{ width: `${result.matchRate}%` }} />
      </div>

      <div className={`${ui.card} ${styles.sameCard}`}>
        <h2 className={ui.cardTitle}>우리는 이런 취향이 같아요</h2>
        {result.same.length > 0 ? (
          <div className={styles.chips}>
            {result.same.map((s) => (
              <span key={s.prompt} className={styles.chip}>
                <span className={styles.chipPrompt}>{s.prompt}</span> <b>{s.mine}</b>
              </span>
            ))}
          </div>
        ) : (
          <p className={styles.none}>겹치는 답이 하나도 없어요</p>
        )}
      </div>
      <div className={`${ui.card} ${styles.diffCard}`}>
        <h2 className={ui.cardTitle}>여기서는 갈렸어요</h2>
        {result.diff.length > 0 ? (
          <div className={styles.diffList}>
            {result.diff.map((d) => (
              <div key={d.prompt}>
                <div className={styles.diffPrompt}>{d.prompt}</div>
                <div className={styles.diffRow}>
                  <span className={styles.mine}>
                    <span className={styles.who}>나</span>
                    {d.mine}
                  </span>
                  <span className={styles.vs}>VS</span>
                  <span className={styles.theirs}>
                    <span className={styles.who}>{FRIEND}</span>
                    {d.theirs}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.none}>모든 답이 같아요!</p>
        )}
      </div>

      <div className={ui.spacer} />
      <div className={ui.stickyBottom}>
        <button type="button" className={ui.secondary} onClick={() => navigate(`/result/${id}`)}>
          내 결과
        </button>
        <button type="button" className={ui.primary} onClick={share.open}>
          다른 친구에게도 보내기
        </button>
      </div>

      <ShareSheet category={category} result={myResult} shareId={toShareId(id, mine.answers)} />
    </div>
  )
}

export default ComparePage
