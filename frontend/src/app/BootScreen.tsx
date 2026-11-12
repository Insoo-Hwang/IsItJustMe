import { useEffect, useState } from 'react'
import StatusScreen from '../components/StatusScreen.tsx'
import shell from './AppShell.module.css'

export type BootProblem = { kind: 'offline' } | { kind: 'maintenance'; notice: string | null } | { kind: 'server' }

type Props = { problem: BootProblem; retry: () => Promise<void> }

// Shown when the app cannot start: no connection, the site under maintenance, or the
// server not answering. Inside the same phone frame as the app, without the router.
function BootScreen({ problem, retry }: Props) {
  const [busy, setBusy] = useState(false)
  const again = () => {
    if (busy) return
    setBusy(true)
    void retry().finally(() => setBusy(false))
  }

  // back online: try again by itself
  useEffect(() => {
    if (problem.kind !== 'offline') return
    const onOnline = () => void retry()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [problem.kind, retry])

  const retryAction = { label: busy ? '확인하는 중…' : '다시 시도', icon: 'refresh', onClick: again }
  return (
    <div className={shell.outer}>
      <div className={shell.frame}>
        <div className={shell.scroll}>
          <div className={shell.screen}>
            {problem.kind === 'offline' && (
              <StatusScreen
                icon="wifi_off"
                title="인터넷에 연결되어 있지 않아요"
                text={'연결을 확인해주세요.\n다시 연결되면 바로 이어서 열려요.'}
                primary={retryAction}
              />
            )}
            {problem.kind === 'maintenance' && (
              <StatusScreen
                icon="construction"
                title="지금은 점검 중이에요"
                text={problem.notice ?? '더 나은 서비스를 위해 잠시 점검하고 있어요. 조금 뒤에 다시 와주세요.'}
                primary={retryAction}
                role="status"
              />
            )}
            {problem.kind === 'server' && (
              <StatusScreen
                icon="cloud_off"
                title="서버와 연결이 잠시 끊겼어요"
                text={'잠시 후 다시 시도해주세요.\n내 답과 결과는 그대로 남아 있어요.'}
                primary={retryAction}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BootScreen
