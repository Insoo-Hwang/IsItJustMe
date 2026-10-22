import type { Category, Choice } from '../data/categories.ts'

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

export const SIMILAR_MIN_MATCHES = 8

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

// Estimated from per-question rates, assuming questions are independent.
// Replace with server-side aggregation once real answers are stored.
export function analyze(category: Category, answers: Choice[]): RarityResult {
  const picks = category.questions.map((q, i) => ({
    n: i + 1,
    prompt: q.prompt,
    choice: answers[i] === 'a' ? q.a : q.b,
    rate: answers[i] === 'a' ? q.aRate : 100 - q.aRate,
  }))
  const p = picks.map((x) => x.rate / 100)
  const mine = p.reduce((acc, x) => acc * x, 1)

  // Sum the probability of every combination at least as rare as mine.
  let rarer = 0
  const aRates = category.questions.map((q) => q.aRate / 100)
  for (let mask = 0; mask < 1 << aRates.length; mask++) {
    let prob = 1
    for (let i = 0; i < aRates.length; i++) {
      prob *= mask & (1 << i) ? 1 - aRates[i] : aRates[i]
    }
    if (prob <= mine * (1 + 1e-9)) rarer += prob
  }
  const top = Math.min(99, Math.max(1, Math.round(rarer * 100)))

  // Poisson-binomial: distribution of how many answers a random participant shares with me.
  let dist = [1]
  for (const x of p) {
    const next = new Array<number>(dist.length + 1).fill(0)
    dist.forEach((v, k) => {
      next[k] += v * (1 - x)
      next[k + 1] += v * x
    })
    dist = next
  }
  const similarProb = dist.slice(SIMILAR_MIN_MATCHES).reduce((acc, x) => acc + x, 0)

  return {
    top,
    tier: tierOf(top),
    headline: headlineOf(top),
    similar: Math.round(similarProb * 1000) / 10,
    exact: Math.round((category.participants - 1) * mine),
    picks,
    rareTop3: [...picks].sort((x, y) => x.rate - y.rate).slice(0, 3),
  }
}

export type CompareItem = { prompt: string; mine: string; theirs: string }

export type CompareResult = {
  matchRate: number
  same: CompareItem[]
  diff: CompareItem[]
  title: string
}

export function compare(category: Category, mine: Choice[], theirs: Choice[]): CompareResult {
  const same: CompareItem[] = []
  const diff: CompareItem[] = []
  category.questions.forEach((q, i) => {
    const item = {
      prompt: q.prompt,
      mine: mine[i] === 'a' ? q.a : q.b,
      theirs: theirs[i] === 'a' ? q.a : q.b,
    }
    ;(mine[i] === theirs[i] ? same : diff).push(item)
  })
  const matchRate = Math.round((same.length / category.questions.length) * 100)
  const title =
    matchRate >= 80
      ? '거의 소울메이트!'
      : matchRate >= 60
        ? '우리는 꽤 비슷해요'
        : matchRate >= 40
          ? '반반 섞인 사이'
          : '정반대라 더 재밌는 사이'
  return { matchRate, same, diff, title }
}
