import type { SummaryDto } from '../api/categories.ts'
import type { Choice, Question } from '../data/categories.ts'

export type PickedChoice = {
  n: number
  prompt: string
  choice: string
  // % of participants who made the same pick
  rate: number
}

export type Tone = 'rare' | 'unique' | 'firm' | 'common'

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

// Tiers by the share of my picks that went with the minority (7+ of 10 → 희귀종).
const TIERS: { min: number; tier: string; tone: Tone; headline: string }[] = [
  { min: 0.7, tier: '희귀종', tone: 'rare', headline: '흔치 않은 조합 그래서 더 특별한 취향' },
  { min: 0.5, tier: '개성파', tone: 'unique', headline: '나만의 길을 가는 취향' },
  { min: 0.3, tier: '소신파', tone: 'firm', headline: '대세 속에서도 소신 있는 취향' },
  { min: 0, tier: '국룰러', tone: 'common', headline: '누구나 끄덕일 취향' },
]

export function tierOf(minority: number, picks: number): { tier: string; tone: Tone; headline: string } {
  const share = picks > 0 ? minority / picks : 0
  const { tier, tone, headline } = TIERS.find((t) => share >= t.min)!
  return { tier, tone, headline }
}

function picksOf(questions: Question[], answers: Choice[]): PickedChoice[] {
  return questions.map((q, i) => ({
    n: i + 1,
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
