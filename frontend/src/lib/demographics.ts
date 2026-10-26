import type { Question } from '../data/categories.ts'
import type { AgeGroup, Gender } from './profile.ts'

// Placeholder until the per-group stats API exists: each group's rate is the overall rate
// shifted by a fixed pseudo-random offset per question and group, so the numbers stay stable.

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
