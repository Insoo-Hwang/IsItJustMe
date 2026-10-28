import { useQueries, useQuery } from '@tanstack/react-query'
import { fetchOverallResult, fetchResult, HttpError, type SummaryDto } from '../api/categories.ts'
import { CATEGORIES, fromAnswerBits, toQuestion, type Category } from '../data/categories.ts'
import { useTestState } from '../store/testStore.ts'
import { rarityOf, sameRatioLabel, tierOf, type RarityResult, type Tone } from './rarity.ts'

export type SummaryRow = {
  category: Category
  rarity: RarityResult
  ratio: string
}

export type Summary = {
  rows: SummaryRow[]
  picks: number
  minority: number
  tier: { tier: string; tone: Tone; headline: string }
  // all categories compared as one combination
  overall: SummaryDto
}

export type SummaryState =
  | { status: 'locked' }
  // finished on this device but the server has no answer, e.g. saved before the answer API
  | { status: 'missing'; categoryId: string }
  | { status: 'error'; retry: () => void }
  | { status: 'loading' }
  | { status: 'ready'; summary: Summary }

const notFound = (err: unknown) => err instanceof HttpError && err.status === 404
const retry = (count: number, err: unknown) => !notFound(err) && count < 2

// Results of every category plus the overall comparison. Locked until all are done.
export function useSummary(): SummaryState {
  const { results } = useTestState()
  const allDone = CATEGORIES.every((c) => results[c.id])
  // same keys as the result page, so visited results come from the cache
  const categoryQueries = useQueries({
    queries: CATEGORIES.map((c) => ({
      queryKey: ['result', c.id],
      queryFn: () => fetchResult(c.id),
      enabled: allDone,
      retry,
    })),
  })
  const overallQuery = useQuery({ queryKey: ['result', 'all'], queryFn: fetchOverallResult, enabled: allDone, retry })

  if (!allDone) return { status: 'locked' }
  const missing = categoryQueries.findIndex((q) => notFound(q.error))
  if (missing >= 0) return { status: 'missing', categoryId: CATEGORIES[missing].id }
  const queries = [...categoryQueries, overallQuery]
  if (queries.some((q) => q.isError)) {
    return { status: 'error', retry: () => queries.forEach((q) => q.isError && void q.refetch()) }
  }
  if (queries.some((q) => !q.data)) return { status: 'loading' }

  const rows = CATEGORIES.map((c, i) => {
    const data = categoryQueries[i].data!
    return {
      category: c,
      rarity: rarityOf(data.questions.map(toQuestion), fromAnswerBits(data.answerBits)),
      ratio: sameRatioLabel(data.overall),
    }
  })
  const picks = rows.reduce((sum, r) => sum + r.rarity.picks.length, 0)
  const minority = rows.reduce((sum, r) => sum + r.rarity.minority, 0)
  return {
    status: 'ready',
    summary: { rows, picks, minority, tier: tierOf(minority, picks), overall: overallQuery.data!.overall },
  }
}
