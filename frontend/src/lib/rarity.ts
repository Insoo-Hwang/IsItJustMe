import type { SummaryDto } from '../api/categories.ts'
import type { Choice, Question } from '../data/categories.ts'
import story from '../data/story.ts'
import type { Tone } from '../../story/parse.ts'

export type { Tone }

export type PickedChoice = {
  n: number
  // which option I picked
  side: Choice
  prompt: string
  choice: string
  // % of participants who made the same pick
  rate: number
}

export type RarityResult = {
  tier: string
  // picks the result card color
  tone: Tone
  headline: string
  // picks that fewer than half of the participants made
  minority: number
  picks: PickedChoice[]
  rareTop3: PickedChoice[]
  commonTop3: PickedChoice[]
}

// Tiers by the share of my picks that went with the minority, from STORY.md chapter 2.
export function tierOf(minority: number, picks: number): { tier: string; tone: Tone; headline: string } {
  const share = picks > 0 ? minority / picks : 0
  const { tier, tone, headline } = story.tiers.find((t) => share >= t.min)!
  return { tier, tone, headline }
}

function picksOf(questions: Question[], answers: Choice[]): PickedChoice[] {
  return questions.map((q, i) => ({
    n: i + 1,
    side: answers[i],
    prompt: q.prompt,
    choice: answers[i] === 'a' ? q.a : q.b,
    rate: answers[i] === 'a' ? q.aRate : 100 - q.aRate,
  }))
}

export function rarityOf(questions: Question[], answers: Choice[]): RarityResult {
  const picks = picksOf(questions, answers)
  const minority = picks.filter((p) => p.rate < 50).length
  const { tier, tone, headline } = tierOf(minority, picks.length)
  return {
    tier,
    tone,
    headline,
    minority,
    picks,
    rareTop3: [...picks].sort((x, y) => x.rate - y.rate).slice(0, 3),
    commonTop3: [...picks].sort((x, y) => y.rate - x.rate).slice(0, 3),
  }
}

// Line for a "top n%" rank, from STORY.md 3-4.
export function rankLineOf(topPercent: number): string {
  return story.rankLines.find((l) => topPercent <= l.max)!.text
}

// "n명 중 1명꼴": how often my exact combination shows up, counting me.
export function sameRatioLabel(summary: SummaryDto): string {
  if (summary.participants <= 1) return '1호 참여자'
  const oneIn = Math.round(summary.participants / (summary.exact + 1))
  if (oneIn <= 1) return '모두 나와 같은 답'
  return `${oneIn.toLocaleString('ko-KR')}명 중 1명꼴`
}

// % of the other participants with identical answers
export function exactRate(summary: SummaryDto): number {
  const others = summary.participants - 1
  return others > 0 ? (summary.exact / others) * 100 : 0
}

// Share of my picks that went with the minority, the value drawn on the category hexagon.
export function minorityShare(result: RarityResult): number {
  return result.picks.length > 0 ? result.minority / result.picks.length : 0
}
