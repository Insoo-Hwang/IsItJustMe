import type { Category, Question } from '../data/categories.ts'
import type { AgeGroup, Gender, GuestProfile } from './profile.ts'

// Placeholder until the stats API exists: each group's rate is the overall rate shifted
// by a fixed pseudo-random offset per question and group, so the numbers stay stable.

const AGE_SHARE: Record<AgeGroup, number> = {
  TEENS: 0.14,
  TWENTIES: 0.38,
  THIRTIES: 0.26,
  FORTIES: 0.14,
  FIFTIES_PLUS: 0.08,
}

const GENDER_SHARE: Record<Gender, number> = { FEMALE: 0.5, MALE: 0.5 }

const SPREAD = 14

function offset(key: string): number {
  let hash = 0
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return (Math.abs(hash) % (SPREAD * 2 + 1)) - SPREAD
}

function clampRate(rate: number): number {
  return Math.min(97, Math.max(3, Math.round(rate)))
}

// % of the group who picked A
export function groupRate(question: Question, group: AgeGroup | Gender): number {
  return clampRate(question.aRate + offset(`${question.id}:${group}`))
}

// The category as seen by people with the same gender and age group.
export function peerCategory(category: Category, profile: GuestProfile): Category {
  return {
    ...category,
    participants: Math.round(category.participants * AGE_SHARE[profile.ageGroup] * GENDER_SHARE[profile.gender]),
    questions: category.questions.map((q) => ({
      ...q,
      aRate: clampRate(q.aRate + offset(`${q.id}:${profile.ageGroup}`) + offset(`${q.id}:${profile.gender}`)),
    })),
  }
}
