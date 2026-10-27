import { useState } from 'react'
import { saveProfile } from '../api/guest.ts'
import TopBar from '../components/TopBar.tsx'
import ui from '../components/ui.module.css'
import { AGE_GROUPS, GENDERS, type AgeGroup, type Gender, type GuestProfile } from '../lib/profile.ts'
import { showToast } from '../lib/toast.ts'
import { setProfile } from '../store/testStore.ts'
import styles from './ProfileStep.module.css'

type Props = {
  title: string
  backLabel: string
  onBack: () => void
  onDone: (profile: GuestProfile) => void
  // set when editing a saved profile from the home screen
  initial?: GuestProfile | null
}

// Asked once per guest, between the last question and the first result. Also reused to edit it.
function ProfileStep({ title, backLabel, onBack, onDone, initial }: Props) {
  const editing = initial !== undefined
  const [gender, setGender] = useState<Gender | null>(initial?.gender ?? null)
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(initial?.ageGroup ?? null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!gender || !ageGroup) {
      showToast(gender ? '나이대를 골라주세요' : '성별을 골라주세요')
      return
    }
    if (saving) return
    const profile = { gender, ageGroup }
    setSaving(true)
    try {
      await saveProfile(profile)
      setProfile(profile)
      onDone(profile)
    } catch (err) {
      console.error(err)
      showToast('저장하지 못했어요. 다시 눌러주세요')
      setSaving(false)
    }
  }

  return (
    <div className={`${ui.page} ${styles.step}`}>
      <TopBar title={title} left={{ icon: 'arrow_back', label: backLabel, onClick: onBack }} />
      {editing ? (
        <div className={styles.head}>
          <h1 className={styles.title}>성별 · 나이대</h1>
          <p className={styles.sub}>바꾸면 이미 끝낸 테스트도 새 또래와 비교해요.</p>
        </div>
      ) : (
        <div className={styles.head}>
          <span className={styles.badge}>결과 보기 전 마지막 단계</span>
          <h1 className={styles.title}>
            내 또래와도
            <br />
            비교해볼까요?
          </h1>
          <p className={styles.sub}>한 번만 알려주면 다음 테스트부터는 묻지 않아요.</p>
        </div>
      )}

      <fieldset className={styles.group}>
        <legend className={styles.legend}>성별</legend>
        <div className={styles.genders}>
          {GENDERS.map((g) => (
            <button
              key={g.value}
              type="button"
              className={styles.option}
              aria-pressed={gender === g.value}
              onClick={() => setGender(g.value)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>나이대</legend>
        <div className={styles.ages}>
          {AGE_GROUPS.map((a) => (
            <button
              key={a.value}
              type="button"
              className={styles.option}
              aria-pressed={ageGroup === a.value}
              onClick={() => setAgeGroup(a.value)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </fieldset>

      <p className={styles.note}>나이대·성별별 통계에만 쓰여요.</p>

      <div className={ui.spacer} />
      <div className={ui.stickyBottom}>
        <button
          type="button"
          className={`${ui.primary} ${ui.large} ${gender && ageGroup ? '' : styles.submitEmpty}`}
          aria-disabled={!gender || !ageGroup || saving}
          onClick={submit}
        >
          {saving ? '저장 중…' : editing ? '저장하기' : '결과 보기'}
        </button>
      </div>
    </div>
  )
}

export default ProfileStep
