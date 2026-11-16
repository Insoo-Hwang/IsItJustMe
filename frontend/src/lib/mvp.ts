import { useQuery } from '@tanstack/react-query'
import { fetchMvp, type MvpDto } from '../api/mvp.ts'
import { CATEGORIES, type Choice } from '../data/categories.ts'
import story from '../data/story.ts'
import { matchingCombos } from '../../story/ending.ts'

export const mvpQuery = { queryKey: ['mvp'], queryFn: fetchMvp, staleTime: 30_000 }

// MVP mode, loaded before the first render. Without an answer the numbers count as open:
// a page that then gets no numbers says so itself.
export function useMvp(): MvpDto | undefined {
  return useQuery(mvpQuery).data
}

export const isLocked = (mvp: MvpDto | undefined) => mvp?.locked === true

// how many finishers are still missing, and how far the bar is filled (0 to 1)
export function mvpProgress(mvp: MvpDto): { left: number; share: number } {
  return {
    left: Math.max(0, mvp.goal - mvp.completers),
    share: mvp.goal > 0 ? Math.min(1, mvp.completers / mvp.goal) : 1,
  }
}

export type TasteKeyword = {
  categoryId: string
  // the option picked on the category's memory question (STORY.md 4, 회상 문항)
  text: string
}

// each category's ten picks by category id
export type AnswersByCategory = Record<string, Choice[] | undefined>

// The pick on each category's memory question, for the categories answered.
function memoryPicks(answers: AnswersByCategory) {
  return CATEGORIES.flatMap((c) => {
    const memory = story.memoryQuestions.find((q) => q.category === c.id)
    const index = c.questions.findIndex((q) => q.id === memory?.question)
    const side = index >= 0 ? answers[c.id]?.[index] : undefined
    return memory && side ? [{ memory, category: c.id, side }] : []
  })
}

// One keyword per category from its memory question, so a profile needs no numbers.
export function tasteKeywords(answers: AnswersByCategory): TasteKeyword[] {
  return memoryPicks(answers).map(({ memory, category, side }) => ({
    categoryId: category,
    text: side === 'a' ? memory.a : memory.b,
  }))
}

// The names of the combos the picks match, from STORY.md 4 (연결 대화).
export function tasteCombos(answers: AnswersByCategory): string[] {
  const picks = memoryPicks(answers).map(({ category, side }) => ({ category, side, rate: 50 }))
  return matchingCombos(story, picks).map((combo) => combo.name)
}
