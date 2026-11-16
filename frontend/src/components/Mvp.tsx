import { useState, type FormEvent, type ReactNode } from 'react'
import type { MvpDto } from '../api/mvp.ts'
import { saveNotifyEmail } from '../api/mvp.ts'
import { CATEGORIES, findCategory, type Choice, type Question } from '../data/categories.ts'
import { mvpProgress, tasteCombos, tasteKeywords, type AnswersByCategory } from '../lib/mvp.ts'
import { showToast } from '../lib/toast.ts'
import Icon from './Icon.tsx'
import ShareSheet from './ShareSheet.tsx'
import ShareUniverseButton from './ShareUniverseButton.tsx'
import styles from './Mvp.module.css'
import ui from './ui.module.css'

const fmt = (n: number) => n.toLocaleString('ko-KR')

// Sends the site to friends. Someone who finished every test shares their own universe,
// so the friend also gets a comparison; anyone else shares the tests.
export function MvpShareButton({ allDone, children }: { allDone: boolean; children: string }) {
  const [open, setOpen] = useState(false)
  const className = `${ui.primary} ${ui.large} ${styles.shareButton}`
  if (allDone) return <ShareUniverseButton className={className}>{children}</ShareUniverseButton>
  return (
    <>
      <button type="button" className={`${className} ${ui.share}`} onClick={() => setOpen(true)}>
        <Icon name="ios_share" size={22} />
        {children}
      </button>
      {open && (
        <ShareSheet
          share={{
            title: '나만 그래?',
            text: '나만 그래? 60개의 선택으로 알아보는 내 취향, 같이 해줘!',
            description: '사람이 모일수록 빨리 열리는 전체 취향 결과',
            button: '테스트하러 가기',
            url: `${location.origin}/main`,
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

// How far the count is from opening the overall results, and the push to invite friends.
// `children` sits above the share button, e.g. the universe the friends will join.
export function MvpGauge({ mvp, allDone, children }: { mvp: MvpDto; allDone: boolean; children?: ReactNode }) {
  const { left, share } = mvpProgress(mvp)
  return (
    <section className={`${ui.card} ${styles.gauge}`} aria-label="전체 결과 공개까지">
      <div className={styles.gaugeLead}>
        <Icon name="lock_clock" size={18} />
        전체 결과 공개까지
      </div>
      <h2 className={styles.gaugeTitle}>
        {left > 0 ? (
          <>
            <b>{fmt(left)}명</b> 남았어요
          </>
        ) : (
          '곧 공개돼요'
        )}
      </h2>
      <div className={styles.track} aria-hidden>
        <span style={{ width: `${Math.max(2, share * 100)}%` }} />
      </div>
      <div className={styles.trackEnds}>
        <span>{fmt(mvp.completers)}명 완주</span>
        <span>목표 {fmt(mvp.goal)}명</span>
      </div>
      <p className={styles.gaugeText}>
        테스트 {CATEGORIES.length}개를 끝낸 사람이 {fmt(mvp.goal)}명 모이면 희귀도, 나와 똑같은 사람, 소수파 순위가 한
        번에 열려요. 친구가 끝낼 때마다 공개가 한 명씩 가까워져요.
      </p>
      {children}
      <MvpShareButton allDone={allDone}>친구 초대해서 빨리 열기</MvpShareButton>
      {allDone && <p className={styles.hint}>친구가 테스트를 다 끝내면 둘의 취향 비교는 바로 볼 수 있어요</p>}
    </section>
  )
}

const SAVED_KEY = 'mvp-email-saved'

function savedBefore(): boolean {
  try {
    return localStorage.getItem(SAVED_KEY) === '1'
  } catch {
    return false
  }
}

// Leaves an address to hear when the overall results open.
export function NotifyEmailForm() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(savedBefore)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await saveNotifyEmail(email.trim())
      try {
        localStorage.setItem(SAVED_KEY, '1')
      } catch {
        // only remembers that the form was sent
      }
      setSaved(true)
    } catch (err) {
      console.error(err)
      showToast('이메일을 저장하지 못했어요. 주소를 확인해주세요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`${ui.card} ${styles.email}`} aria-label="공개 알림 받기">
      <h2 className={ui.cardTitle}>공개되면 알려드릴게요</h2>
      {saved ? (
        <p className={styles.emailDone}>
          <Icon name="mark_email_read" size={20} />
          알림 신청을 받았어요. 결과가 열리면 메일로 알려드릴게요.
          <button type="button" className={styles.emailAgain} onClick={() => setSaved(false)}>
            다른 주소로 받기
          </button>
        </p>
      ) : (
        <form className={styles.emailForm} onSubmit={(e) => void submit(e)}>
          <input
            type="email"
            className={styles.emailInput}
            placeholder="이메일 주소"
            autoComplete="email"
            maxLength={254}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className={`${ui.primary} ${styles.emailButton}`} disabled={busy || !email.trim()}>
            알림 받기
          </button>
        </form>
      )}
      <p className={styles.emailNote}>공개 알림을 보내는 데만 쓰고, 보낸 뒤에는 지워요.</p>
    </section>
  )
}

// One keyword per category from the picks, with the combo they make. No numbers needed.
export function TasteProfile({ answers, title }: { answers: AnswersByCategory; title: string }) {
  const keywords = tasteKeywords(answers)
  const combo = tasteCombos(answers)[0]
  return (
    <section className={styles.profile} aria-label={title}>
      <div className={styles.profileLead}>{title}</div>
      {combo && <h1 className={styles.profileCombo}>{combo}</h1>}
      <ul className={styles.keywords}>
        {keywords.map(({ categoryId, text }) => {
          const category = findCategory(categoryId)
          return (
            <li key={categoryId} className={styles.keyword}>
              {category && (
                <span className={styles.keywordIcon} style={{ background: category.tint.bg, color: category.tint.fg }}>
                  <Icon name={category.icon} size={16} filled />
                </span>
              )}
              {text}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// My ten picks with the other option beside each, the share of each side kept hidden.
export function AnswerReview({ questions, answers }: { questions: Question[]; answers: Choice[] }) {
  return (
    <section className={`${ui.card} ${styles.review}`} aria-label="내 답 돌아보기">
      <h2 className={ui.cardTitle}>내 답 돌아보기</h2>
      <ol className={styles.reviewList}>
        {questions.map((q, i) => (
          <li key={q.id} className={styles.reviewItem}>
            <div className={styles.reviewPrompt}>
              <span className={styles.reviewNo}>{i + 1}</span>
              {q.prompt}
            </div>
            <div className={styles.reviewOptions}>
              {(['a', 'b'] as const).map((side) => (
                <span key={side} className={answers[i] === side ? styles.reviewPicked : styles.reviewOption}>
                  {answers[i] === side && <Icon name="check" size={14} />}
                  {side === 'a' ? q.a : q.b}
                  <small>?%</small>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <p className={styles.reviewNote}>몇 %가 나와 같은 답을 골랐는지는 전체 결과가 열리면 보여요.</p>
    </section>
  )
}

// What opens with the overall results, shown closed.
export function LockedStats({ items }: { items: string[] }) {
  return (
    <section className={styles.locked} aria-label="공개되면 볼 수 있는 결과">
      {items.map((label) => (
        <div key={label} className={`${ui.card} ${styles.lockedCard}`}>
          <span className={styles.lockedValue} aria-hidden>
            ?
          </span>
          <span className={styles.lockedLabel}>
            <Icon name="lock" size={14} />
            {label}
          </span>
        </div>
      ))}
    </section>
  )
}
