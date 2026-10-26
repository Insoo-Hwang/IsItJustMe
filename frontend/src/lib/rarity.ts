import type { SummaryDto } from '../api/categories.ts'
import type { Choice, Question } from '../data/categories.ts'

export type PickedChoice = {
  n: number
  prompt: string
  choice: string
  // % of participants who made the same pick
  rate: number
}

export type RarityResult = {
  // "상위 n%": share of participants whose combination is as rare as mine or rarer
  top: number
  tier: string
  headline: string
  // % of other participants matching at least 8 of 10 answers
  similar: number
  // other participants with identical answers
  exact: number
  picks: PickedChoice[]
  rareTop3: PickedChoice[]
}

export function tierOf(top: number): string {
  if (top <= 10) return '희귀종'
  if (top <= 25) return '개성파'
  if (top <= 50) return '반반러'
  return '국룰러'
}

function headlineOf(top: number): string {
  if (top <= 10) return '이 조합, 거의 없어요'
  if (top <= 25) return '한 끗이 달라요'
  if (top <= 50) return '대세 반, 개성 반'
  return '누구나 끄덕일 취향'
}

function picksOf(questions: Question[], answers: Choice[]): PickedChoice[] {
  return questions.map((q, i) => ({
    n: i + 1,
    prompt: q.prompt,
    choice: answers[i] === 'a' ? q.a : q.b,
    rate: answers[i] === 'a' ? q.aRate : 100 - q.aRate,
  }))
}

function rareTop3Of(picks: PickedChoice[]): PickedChoice[] {
  return [...picks].sort((x, y) => x.rate - y.rate).slice(0, 3)
}

// Real numbers counted by the server from everyone who answered the same questions.
export function fromSummary(questions: Question[], answers: Choice[], summary: SummaryDto): RarityResult {
  const picks = picksOf(questions, answers)
  return {
    top: summary.top,
    tier: tierOf(summary.top),
    headline: headlineOf(summary.top),
    similar: summary.similar,
    exact: summary.exact,
    picks,
    rareTop3: rareTop3Of(picks),
  }
}
