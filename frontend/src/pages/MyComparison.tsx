import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchComparison, joinUniverse } from '../api/rooms.ts'
import Icon from '../components/Icon.tsx'
import NameSheet from '../components/NameSheet.tsx'
import RarityHexagon from '../components/RarityHexagon.tsx'
import ui from '../components/ui.module.css'
import { fromAnswerBits, shortName, type Category, type Choice, type Question } from '../data/categories.ts'
import { withAnd } from '../lib/korean.ts'
import { minorityShare } from '../lib/rarity.ts'
import { matchLine, roomRetry, rowsOf } from '../lib/room.ts'
import { showToast } from '../lib/toast.ts'
import styles from './RoomPage.module.css'

const QUESTIONS_PER_CATEGORY = 10

type Props = {
  token: string
  ownerName: string
}

type QuestionListProps = {
  category: Category
  owner: string
  ownerBits: number
  myBits: number
}

// Every question of one category with the owner's pick next to mine.
function QuestionList({ category, owner, ownerBits, myBits }: QuestionListProps) {
  const ownerPicks = fromAnswerBits(ownerBits)
  const myPicks = fromAnswerBits(myBits)
  const text = (q: Question, choice: Choice) => (choice === 'a' ? q.a : q.b)
  return (
    <ol className={styles.questions}>
      {category.questions.map((q, i) => {
        const same = ownerPicks[i] === myPicks[i]
        return (
          <li key={q.id} className={styles.question}>
            <div className={styles.questionHead}>
              <span className={styles.questionPrompt}>
                {i + 1}. {q.prompt}
              </span>
              <span className={same ? styles.same : styles.diff}>{same ? '같아요' : '달라요'}</span>
            </div>
            <div className={styles.answers}>
              <span className={styles.answerOwner}>
                <b>{owner}</b> {text(q, ownerPicks[i])}
              </span>
              <span className={styles.answerMine}>
                <b>나</b> {text(q, myPicks[i])}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// The owner and the viewer, hexagons drawn over each other. The API compares only the
// viewer, so nobody sees two other people compared.
function MyComparison({ token, ownerName: owner }: Props) {
  const queryClient = useQueryClient()
  const [joining, setJoining] = useState(false)
  const [busy, setBusy] = useState(false)
  const [openCode, setOpenCode] = useState<string | null>(null)
  const query = useQuery({ queryKey: ['comparison', token], queryFn: () => fetchComparison(token), retry: roomRetry })

  if (query.isError) {
    return (
      <div className={`${ui.card} ${styles.sectionStatus}`} role="alert">
        비교 결과를 불러오지 못했어요
        <button type="button" className={ui.secondary} onClick={() => void query.refetch()}>
          다시 시도
        </button>
      </div>
    )
  }
  if (!query.data) {
    return (
      <div className={`${ui.card} ${styles.sectionStatus}`} role="status">
        {withAnd(owner)} 비교하는 중…
      </div>
    )
  }

  const data = query.data
  const ownerRows = rowsOf(data.categories.map((c) => ({ code: c.code, bits: c.ownerBits })))
  const myRows = rowsOf(data.categories.map((c) => ({ code: c.code, bits: c.otherBits })))
  const matched = data.categories.map((c, i) => ({ ...c, label: ownerRows[i] ? shortName(ownerRows[i].category) : c.code }))
  // ties go to the earlier category
  const similar = matched.reduce((best, c) => (c.matched > best.matched ? c : best))
  const different = matched.reduce((worst, c) => (c.matched < worst.matched ? c : worst))

  const join = async (name: string) => {
    setBusy(true)
    try {
      await joinUniverse(token, name)
      await Promise.all(
        ['comparison', 'room', 'universe'].map((key) => queryClient.invalidateQueries({ queryKey: [key, token] })),
      )
      setJoining(false)
      showToast(`${owner}의 취향 우주에 행성이 생겼어요`)
    } catch (err) {
      console.error(err)
      showToast('등록하지 못했어요. 다시 시도해주세요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className={styles.versus} aria-label="나와의 취향 일치율">
        <div className={styles.versusNames}>
          <span className={styles.ownerName}>{owner}</span>
          <span aria-hidden>vs</span>
          <span className={styles.otherName}>{data.planetName ? `${data.planetName}(나)` : '나'}</span>
        </div>
        <div className={styles.matchLabel}>취향 일치율</div>
        <div className={styles.matchValue}>
          {data.match}
          <small>%</small>
        </div>
        <p className={styles.matchLine}>{matchLine(data.match)}</p>
        {data.planetId == null && (
          <button type="button" className={`${ui.primary} ${styles.versusButton}`} onClick={() => setJoining(true)}>
            <Icon name="add" size={22} />
            {owner}의 취향 우주에 나 등록하기
          </button>
        )}
      </section>

      <section className={`${ui.card} ${styles.chartCard} ${styles.pair}`} aria-label="카테고리별 소수 선택 비율">
        <h2 className={ui.cardTitle}>카테고리별 소수 선택 비율</h2>
        <div className={styles.legend}>
          <span className={styles.legendOwner}>{owner}</span>
          <span className={styles.legendOther}>나</span>
        </div>
        <RarityHexagon
          axes={ownerRows.map((r) => ({ label: shortName(r.category), value: minorityShare(r.rarity) }))}
          other={myRows.map((r) => minorityShare(r.rarity))}
        />
        <p className={styles.note}>
          문항마다 더 적은 사람이 고른 쪽을 몇 개 골랐는지예요. 모양이 비슷해도 고른 답은 다를 수 있어요.
        </p>
      </section>

      <div className={styles.extremes}>
        <div className={`${ui.card} ${styles.extreme}`}>
          <div className={styles.extremeLabel}>가장 비슷한 취향</div>
          <div className={styles.extremeValue}>{similar.label}</div>
          <div className={styles.extremeNote}>
            {similar.matched}/{QUESTIONS_PER_CATEGORY} 일치
          </div>
        </div>
        <div className={`${ui.card} ${styles.extreme}`}>
          <div className={styles.extremeLabel}>가장 다른 취향</div>
          <div className={styles.extremeValue}>{different.label}</div>
          <div className={styles.extremeNote}>
            {different.matched}/{QUESTIONS_PER_CATEGORY} 일치
          </div>
        </div>
      </div>

      <section className={`${ui.card} ${styles.bars}`} aria-label="카테고리별 같은 답">
        <p className={styles.barsHint}>카테고리를 누르면 문항별로 볼 수 있어요</p>
        <ul className={styles.barList}>
          {matched.map((c, i) => {
            const open = openCode === c.code
            return (
              <li key={c.code}>
                <button
                  type="button"
                  className={styles.bar}
                  aria-expanded={open}
                  onClick={() => setOpenCode(open ? null : c.code)}
                >
                  <span className={styles.barLabel}>{c.label}</span>
                  <span className={styles.barTrack}>
                    <span
                      className={styles.barFill}
                      style={{ width: `${(c.matched / QUESTIONS_PER_CATEGORY) * 100}%` }}
                    />
                  </span>
                  <span className={styles.barValue}>
                    {c.matched}/{QUESTIONS_PER_CATEGORY}
                  </span>
                  <Icon name={open ? 'expand_less' : 'expand_more'} size={20} className={styles.barChevron} />
                </button>
                {open && ownerRows[i] && (
                  <QuestionList
                    category={ownerRows[i].category}
                    owner={owner}
                    ownerBits={c.ownerBits}
                    myBits={c.otherBits}
                  />
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {joining && (
        <NameSheet
          title="행성 이름 정하기"
          description={`링크를 가진 누구나 이 이름과 ${withAnd(owner)}의 일치율을 볼 수 있어요. 자세한 비교는 나만 볼 수 있어요.`}
          confirmLabel="이 방에 내 결과 공개하기"
          busy={busy}
          onSubmit={(name) => void join(name)}
          onClose={() => setJoining(false)}
        />
      )}
    </>
  )
}

export default MyComparison
