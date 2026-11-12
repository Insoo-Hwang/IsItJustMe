import { useNavigate } from 'react-router'
import StatusScreen from '../components/StatusScreen.tsx'

// Any address the app does not know, and links to a category or question that is gone.
function NotFoundPage() {
  const navigate = useNavigate()
  // a page opened straight from a link has no page of ours to go back to
  const canGoBack = (window.history.state as { idx?: number } | null)?.idx ? true : false
  return (
    <StatusScreen
      icon="explore_off"
      code="404"
      title="페이지를 찾을 수 없어요"
      text={'주소가 바뀌었거나 없어진 페이지예요.\n주소를 다시 확인해주세요.'}
      primary={{ label: '홈으로', icon: 'home', onClick: () => navigate('/main', { replace: true }) }}
      secondary={canGoBack ? { label: '이전 페이지로', icon: 'arrow_back', onClick: () => navigate(-1) } : undefined}
    />
  )
}

export default NotFoundPage
