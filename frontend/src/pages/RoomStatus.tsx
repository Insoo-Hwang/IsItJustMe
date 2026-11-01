import { useNavigate } from 'react-router'
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
  return (
    <div className={`${ui.page} ${styles.status}`} role="alert">
      {props.kind === 'missing' ? '없는 링크예요. 주소를 다시 확인해주세요' : '불러오지 못했어요'}
      <button
        type="button"
        className={ui.secondary}
        onClick={props.kind === 'missing' ? () => navigate('/main') : props.retry}
      >
        {props.kind === 'missing' ? '홈으로' : '다시 시도'}
      </button>
    </div>
  )
}

export default RoomStatus
