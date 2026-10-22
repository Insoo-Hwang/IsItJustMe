import { findCategory, QUESTION_COUNT, type Category, type Choice } from '../data/categories.ts'

// Until results are stored server-side, the share id carries the answers itself:
// "<catId>-<answers as a base36 bitmask>", e.g. "food-ks".
export function toShareId(catId: string, answers: Choice[]): string {
  const bits = answers.reduce((acc, c, i) => (c === 'b' ? acc | (1 << i) : acc), 0)
  return `${catId}-${bits.toString(36)}`
}

export function parseShareId(shareId: string | undefined): { category: Category; answers: Choice[] } | null {
  const match = /^([a-z]+)-([0-9a-z]{1,2})$/.exec(shareId ?? '')
  const category = findCategory(match?.[1])
  if (!match || !category) return null
  const bits = parseInt(match[2], 36)
  if (bits >= 1 << QUESTION_COUNT) return null
  const answers = Array.from({ length: QUESTION_COUNT }, (_, i): Choice => (bits & (1 << i) ? 'b' : 'a'))
  return { category, answers }
}

export function shareUrl(shareId: string): string {
  return `${window.location.origin}/compare/${shareId}`
}
