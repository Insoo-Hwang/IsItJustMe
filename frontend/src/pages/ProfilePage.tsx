import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { showToast } from '../lib/toast.ts'
import { useTestState } from '../store/testStore.ts'
import ProfileStep from './ProfileStep.tsx'

function ProfilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile } = useTestState()

  const done = () => {
    // saved answers moved to the new profile, so cached results are stale
    void queryClient.invalidateQueries({ queryKey: ['result'] })
    showToast('저장했어요')
    navigate('/main')
  }

  return (
    <ProfileStep
      key={profile ? `${profile.gender}-${profile.ageGroup}` : 'none'}
      title="나의 정보"
      backLabel="홈으로"
      onBack={() => navigate('/main')}
      onDone={done}
      initial={profile}
    />
  )
}

export default ProfilePage
