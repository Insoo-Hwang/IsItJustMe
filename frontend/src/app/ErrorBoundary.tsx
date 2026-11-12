import { Component, type ErrorInfo, type ReactNode } from 'react'
import StatusScreen from '../components/StatusScreen.tsx'

type Props = { children: ReactNode }
type State = { failed: boolean }

// Catches a page that throws while rendering, so one broken screen shows a way out instead
// of a blank app. AppShell keys it by path, so moving to another page starts fresh.
class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <StatusScreen
        icon="error"
        title="화면을 그리다 문제가 생겼어요"
        text={'잠시 후 다시 시도해주세요.\n문제가 계속되면 홈에서 다시 시작해주세요.'}
        primary={{ label: '다시 시도', icon: 'refresh', onClick: () => window.location.reload() }}
        secondary={{ label: '홈으로', icon: 'home', onClick: () => window.location.assign('/main') }}
      />
    )
  }
}

export default ErrorBoundary
