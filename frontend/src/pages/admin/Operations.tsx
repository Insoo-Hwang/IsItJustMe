import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { HttpError } from '../../api/categories.ts'
import { setTrackingOff, trackingOff } from '../../lib/track.ts'
import {
  fetchMaintenance,
  fetchMvpAdmin,
  fetchNotifyEmails,
  saveMaintenance,
  saveMvpAdmin,
  type Maintenance,
  type MvpAdmin,
} from './api.ts'
import { Card } from './charts.tsx'
import styles from './admin.module.css'

const MAX_MESSAGE = 200

function MaintenanceForm({ token, current }: { token: string; current: Maintenance }) {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState(current.message)
  const save = useMutation({
    mutationFn: (enabled: boolean) => saveMaintenance(token, enabled, message),
    onSuccess: (next) => queryClient.setQueryData(['admin', 'maintenance', token], next),
  })

  const toggle = () => {
    const enabling = !current.enabled
    if (enabling && !window.confirm('점검 모드를 켜면 방문자는 테스트를 할 수 없고 점검 안내만 봐요. 켤까요?')) return
    save.mutate(enabling)
  }

  return (
    <>
      <div className={styles.opsState}>
        <span className={current.enabled ? styles.opsDotOn : styles.opsDot} aria-hidden />
        <div>
          <div className={styles.opsStateTitle}>
            {current.enabled ? '점검 중 · 방문자 화면이 닫혀 있어요' : '정상 운영 중'}
          </div>
          {current.since && (
            <div className={styles.opsStateSub}>{new Date(current.since).toLocaleString('ko-KR')}부터</div>
          )}
        </div>
        <button
          type="button"
          className={current.enabled ? styles.opsOpen : styles.opsClose}
          disabled={save.isPending}
          onClick={toggle}
        >
          {current.enabled ? '점검 끝내기' : '점검 시작'}
        </button>
      </div>
      <label className={styles.opsLabel} htmlFor="maintenance-message">
        방문자에게 보일 안내 문구
      </label>
      <textarea
        id="maintenance-message"
        className={styles.opsMessage}
        value={message}
        maxLength={MAX_MESSAGE}
        rows={3}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className={styles.opsFoot}>
        <span>
          {message.length}/{MAX_MESSAGE} · 비우면 기본 문구
        </span>
        {current.enabled && (
          <button
            type="button"
            className={styles.action}
            disabled={save.isPending || message === current.message}
            onClick={() => save.mutate(true)}
          >
            문구만 바꾸기
          </button>
        )}
      </div>
      {save.isError && (
        <p className={styles.error} role="alert">
          저장하지 못했어요. 다시 시도해주세요.
        </p>
      )}
    </>
  )
}

// MVP mode: the overall numbers stay closed until enough guests finish every test.
function MvpForm({ token, current }: { token: string; current: MvpAdmin }) {
  const queryClient = useQueryClient()
  const [downloading, setDownloading] = useState(false)
  const save = useMutation({
    mutationFn: (enabled: boolean) => saveMvpAdmin(token, enabled),
    onSuccess: (next) => queryClient.setQueryData(['admin', 'mvp', token], next),
  })
  const fmt = (n: number) => n.toLocaleString('ko-KR')

  const toggle = () => {
    const enabling = !current.enabled
    const ask = enabling
      ? `MVP 기능을 켜면 완주자가 ${fmt(current.goal)}명이 될 때까지 전체 통계가 다시 가려져요. 켤까요?`
      : 'MVP 기능을 끄면 지금 바로 모든 방문자에게 전체 통계가 열려요. 끌까요?'
    if (window.confirm(ask)) save.mutate(enabling)
  }

  // every address as a CSV file, to send the opening notice by hand
  const download = async () => {
    setDownloading(true)
    try {
      const rows = await fetchNotifyEmails(token)
      const csv = ['email,created_at', ...rows.map((r) => `${r.email},${r.createdAt}`)].join('\n')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `notify-emails-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <div className={styles.opsState}>
        <span className={current.locked ? styles.opsDotOn : styles.opsDot} aria-hidden />
        <div>
          <div className={styles.opsStateTitle}>
            {!current.enabled
              ? 'MVP 종료 · 전체 통계가 열려 있어요'
              : current.locked
                ? 'MVP 진행 중 · 전체 통계를 가리고 있어요'
                : 'MVP 켜짐 · 목표를 채워 통계가 열렸어요'}
          </div>
          <div className={styles.opsStateSub}>
            완주자 {fmt(current.completers)} / {fmt(current.goal)}명 · 알림 신청 {fmt(current.emails)}명
          </div>
        </div>
        <button
          type="button"
          className={current.enabled ? styles.opsOpen : styles.opsClose}
          disabled={save.isPending}
          onClick={toggle}
        >
          {current.enabled ? 'MVP 종료' : 'MVP 켜기'}
        </button>
      </div>
      <div className={styles.opsFoot}>
        <span>완주자 수는 최대 몇 분 늦게 반영돼요</span>
        <button
          type="button"
          className={styles.action}
          disabled={downloading || current.emails === 0}
          onClick={() => void download()}
        >
          알림 이메일 내려받기 (CSV)
        </button>
      </div>
      {save.isError && (
        <p className={styles.error} role="alert">
          저장하지 못했어요. 다시 시도해주세요.
        </p>
      )}
    </>
  )
}

// Whether this browser's visits count. Signing in to the admin page turns them off, so the
// operator's own testing never reaches the numbers advertisers see.
function TrackingSwitch() {
  const [off, setOff] = useState(trackingOff)
  const toggle = () => {
    setTrackingOff(!off)
    setOff(!off)
  }
  return (
    <div className={styles.opsState}>
      <span className={off ? styles.opsDot : styles.opsDotOn} aria-hidden />
      <div>
        <div className={styles.opsStateTitle}>{off ? '이 브라우저는 기록하지 않아요' : '이 브라우저도 기록하고 있어요'}</div>
        <div className={styles.opsStateSub}>광고 노출 · 클릭, 공유 같은 행동 기록이 통계에 들어가는지</div>
      </div>
      <button type="button" className={styles.action} onClick={toggle}>
        {off ? '기록 켜기' : '기록 끄기'}
      </button>
    </div>
  )
}

// Running the site: MVP mode, maintenance mode and this browser's tracking.
function Operations({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const query = useQuery({
    queryKey: ['admin', 'maintenance', token],
    queryFn: async () => {
      try {
        return await fetchMaintenance(token)
      } catch (err) {
        if (err instanceof HttpError && err.status === 401) onUnauthorized()
        throw err
      }
    },
  })

  const mvp = useQuery({ queryKey: ['admin', 'mvp', token], queryFn: () => fetchMvpAdmin(token) })

  return (
    <div className={`${styles.cards} ${styles.opsCards}`}>
      <Card
        title="MVP 기능"
        sub="켜져 있으면 완주자가 목표 인원이 될 때까지 희귀도 · 비교 통계 · 엔딩을 가리고, 취향 키워드와 공유 · 알림 신청을 보여줘요. 끄면 바로 모든 결과가 열려요. 설정은 DB에 저장돼 서버를 다시 시작해도 유지돼요."
        size="half"
      >
        {mvp.data ? (
          <MvpForm token={token} current={mvp.data} />
        ) : (
          <p className={styles.empty}>{mvp.isError ? '상태를 불러오지 못했어요.' : '불러오는 중…'}</p>
        )}
      </Card>
      <Card
        title="점검 모드"
        sub="켜면 방문자 API가 모두 503으로 답하고, 화면에는 점검 안내가 보여요. 어드민은 그대로 열려 있어요. 서버를 다시 시작하면 MAINTENANCE 설정값으로 돌아가요."
        size="half"
      >
        {query.data ? (
          <MaintenanceForm key={String(query.data.enabled)} token={token} current={query.data} />
        ) : (
          <p className={styles.empty}>{query.isError ? '상태를 불러오지 못했어요.' : '불러오는 중…'}</p>
        )}
      </Card>
      <Card
        title="내 방문 제외"
        sub="어드민에 들어온 브라우저는 자동으로 기록을 꺼요. 같은 기기의 다른 브라우저나 휴대폰은 따로 꺼야 해요."
        size="half"
      >
        <TrackingSwitch />
      </Card>
    </div>
  )
}

export default Operations
