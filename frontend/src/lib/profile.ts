export type Gender = 'FEMALE' | 'MALE'
export type AgeGroup = 'TEENS' | 'TWENTIES' | 'THIRTIES' | 'FORTIES' | 'FIFTIES_PLUS'

export type GuestProfile = {
  gender: Gender
  ageGroup: AgeGroup
}

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'FEMALE', label: '여성' },
  { value: 'MALE', label: '남성' },
]

export const AGE_GROUPS: { value: AgeGroup; label: string }[] = [
  { value: 'TEENS', label: '10대' },
  { value: 'TWENTIES', label: '20대' },
  { value: 'THIRTIES', label: '30대' },
  { value: 'FORTIES', label: '40대' },
  { value: 'FIFTIES_PLUS', label: '50대 이상' },
]

export function genderLabel(gender: Gender): string {
  return GENDERS.find((g) => g.value === gender)?.label ?? ''
}

export function ageGroupLabel(ageGroup: AgeGroup): string {
  return AGE_GROUPS.find((a) => a.value === ageGroup)?.label ?? ''
}
