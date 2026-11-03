import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { HttpError } from '../api/categories.ts'
import { fetchUniverse, type RoomDto } from '../api/rooms.ts'
import RarityHexagon from '../components/RarityHexagon.tsx'
import ShareUniverseButton from '../components/ShareUniverseButton.tsx'
import TasteUniverse from '../components/TasteUniverse.tsx'
import tier from '../components/tier.module.css'
import TopBar from '../components/TopBar.tsx'
import ui from '../components/ui.module.css'
import { CATEGORIES, shortName } from '../data/categories.ts'
import { withAnd, withTopic } from '../lib/korean.ts'
import { minorityShare, tierOf } from '../lib/rarity.ts'
import { roomQuery, roomRetry, rowsOf } from '../lib/room.ts'
import { clearInvite, setInvite } from '../store/testStore.ts'
import MyComparison from './MyComparison.tsx'
import RoomStatus from './RoomStatus.tsx'
import styles from './RoomPage.module.css'

// The owner's results before the friend has taken the tests.
function OwnerPreview({ token, room }: { token: string; room: RoomDto }) {
  const navigate = useNavigate()
  const name = room.ownerName
  const rows = rowsOf(room.owner.map((c) => ({ code: c.code, bits: c.answerBits })))

  // home shows the tests and, with the invite remembered, the way back here
  const takeTests = () => {
    setInvite({ token })
    navigate('/main')
  }

  return (
    <>
      <section className={`${ui.card} ${styles.chartCard}`} aria-label={`${name}의 결과 미리보기`}>
        <h2 className={ui.cardTitle}>{name}의 카테고리별 소수 선택 비율</h2>
        <RarityHexagon axes={rows.map((r) => ({ label: shortName(r.category), value: minorityShare(r.rarity) }))} />
        <ul className={styles.chips}>
          {rows.map(({ category, rarity }) => (
            <li key={category.id} className={`${styles.chip} ${tier[rarity.tone]}`}>
              {shortName(category)} <b>{rarity.tier}</b>
            </li>
          ))}
        </ul>
      </section>
      <div className={styles.actions}>
        <button type="button" className={`${ui.primary} ${ui.large}`} onClick={takeTests}>
          나도 테스트하고 {withAnd(name)} 비교하기
        </button>
        <p className={styles.hint}>테스트 {CATEGORIES.length}개를 끝내면 여기서 바로 비교 결과가 나와요</p>
      </div>
    </>
  )
}

// One page per share link: the invite, the owner's taste universe, and the viewer's own
// comparison with the owner.
function InvitePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const room = useQuery(roomQuery(token))
  const universe = useQuery({ queryKey: ['universe', token], queryFn: () => fetchUniverse(token), retry: roomRetry })

  const queries = [room, universe]
  const missing = queries.some((q) => q.error instanceof HttpError && q.error.status === 404)
  // The home page shows the way back here only until it is no longer needed: the viewer
  // turned out to be the owner, finished every test and sees the comparison, or the room is gone.
  const settled = missing || room.data?.viewer.role === 'OWNER' || room.data?.viewer.complete === true
  useEffect(() => {
    if (settled) clearInvite(token)
  }, [settled, token])

  if (missing) return <RoomStatus kind="missing" />
  if (queries.some((q) => q.isError)) {
    return <RoomStatus kind="error" retry={() => queries.forEach((q) => q.isError && void q.refetch())} />
  }
  if (!room.data || !universe.data) return <RoomStatus kind="loading" />

  const { ownerName: name, owner, viewer } = room.data
  const rows = rowsOf(owner.map((c) => ({ code: c.code, bits: c.answerBits })))
  const overall = tierOf(
    rows.reduce((sum, r) => sum + r.rarity.minority, 0),
    rows.reduce((sum, r) => sum + r.rarity.picks.length, 0),
  )
  const isOwner = viewer.role === 'OWNER'

  return (
    <div className={`${ui.page} ${styles.page}`}>
      <TopBar title="나만 그래?" left={{ icon: 'home', label: '홈으로', onClick: () => navigate('/main') }} />

      <section className={`${styles.invite} ${tier[overall.tone]}`} aria-label={`${name}의 초대장`}>
        <div className={styles.inviteBadge}>{isOwner ? '나의 취향 우주' : `${name}의 초대장`}</div>
        <h1 className={styles.inviteTitle}>
          {isOwner ? (
            <>
              친구들은 나랑
              <br />
              얼마나 다를까?
            </>
          ) : (
            <>
              {withTopic(name)} 얼마나
              <br />
              특이한 사람일까?
            </>
          )}
        </h1>
        <p className={styles.inviteText}>
          {isOwner
            ? '링크로 놀러 온 친구들이 행성이 돼요.'
            : `${name}의 ${CATEGORIES.length}가지 취향 결과가 도착했어요. 당신과는 얼마나 다를까요?`}
        </p>
        <div className={styles.inviteDone}>
          테스트 {CATEGORIES.length}개 완료 · 종합 <b>{overall.tier}</b>
        </div>
      </section>

      {isOwner ? (
        <div className={styles.actions}>
          <ShareUniverseButton className={`${ui.primary} ${ui.large}`}>친구에게 다시 공유하기</ShareUniverseButton>
        </div>
      ) : (
        <>
          <h2 className={styles.sectionTitle}>{withAnd(name)} 나</h2>
          {viewer.complete ? <MyComparison token={token} ownerName={name} /> : <OwnerPreview token={token} room={room.data} />}
        </>
      )}

      <h2 className={styles.sectionTitle}>{name}의 취향 우주</h2>
      <TasteUniverse ownerName={name} planets={universe.data} />

      {!isOwner && viewer.complete && (
        <div className={styles.actions}>
          <ShareUniverseButton className={`${ui.primary} ${ui.large}`}>내 결과도 공유하기</ShareUniverseButton>
        </div>
      )}
    </div>
  )
}

export default InvitePage
