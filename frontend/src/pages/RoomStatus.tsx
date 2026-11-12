import { useNavigate } from 'react-router'
import StatusScreen from '../components/StatusScreen.tsx'
import ui from '../components/ui.module.css'
import styles from './RoomPage.module.css'

type Props = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error'; retry: () => void }

// Loading, broken link and failure screens shared by the invite, compare and universe pages.
function RoomStatus(props: Props) {
  const navigate = useNavigate()
  if (props.kind === 'loading') {
    return (
      <div className={`${ui.page} ${styles.status}`} role="status">
        취향 우주를 불러오는 중…
      </div>
    )
  }
  if (props.kind === 'missing') {
    return (
      <StatusScreen
        icon="link_off"
        title="없는 공유 링크예요"
        text={'링크가 잘못 복사됐거나 사라진 우주예요.\n친구에게 링크를 다시 받아주세요.'}
        primary={{ label: '나도 테스트하기', icon: 'home', onClick: () => navigate('/main', { replace: true }) }}
      />
    )
  }
  return (
    <StatusScreen
      icon="cloud_off"
      title="취향 우주를 불러오지 못했어요"
      text="잠시 후 다시 시도해주세요."
      primary={{ label: '다시 시도', icon: 'refresh', onClick: props.retry }}
      secondary={{ label: '홈으로', icon: 'home', onClick: () => navigate('/main') }}
    />
  )
}

export default RoomStatus
