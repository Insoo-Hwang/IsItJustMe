import { fetchCategories, type CategoryDto, type QuestionDto } from '../api/categories.ts'

export type Choice = 'a' | 'b'

export type Question = {
  id: string
  prompt: string
  a: string
  b: string
  // % of participants who picked A
  aRate: number
}

export type Category = {
  id: string
  name: string
  icon: string
  desc: string
  tagline: string
  minutes: number
  recommend: string[]
  participants: number
  tint: { bg: string; fg: string }
  questions: Question[]
}

export const QUESTION_COUNT = 10

// Card colors are part of the design, so they stay here instead of the DB. The values
// live in index.css so they can change with the color scheme.
const TINTS: Record<string, Category['tint']> = Object.fromEntries(
  ['food', 'love', 'life', 'travel', 'spending', 'people'].map((code) => [
    code,
    { bg: `var(--cat-${code}-bg)`, fg: `var(--cat-${code}-fg)` },
  ]),
)

const DEFAULT_TINT: Category['tint'] = { bg: 'var(--surface-2)', fg: 'var(--ink-2)' }

export function toQuestion(dto: QuestionDto): Question {
  return { id: dto.code, prompt: dto.prompt, a: dto.option0, b: dto.option1, aRate: dto.option0Rate }
}

function toCategory(dto: CategoryDto): Category {
  return {
    id: dto.code,
    name: dto.name,
    icon: dto.icon,
    desc: dto.description,
    tagline: dto.tagline,
    minutes: dto.minutes,
    recommend: dto.recommend,
    participants: dto.participants,
    tint: TINTS[dto.code] ?? DEFAULT_TINT,
    questions: dto.questions.map(toQuestion),
  }
}

// Filled once by loadCategories() before the app renders.
export let CATEGORIES: Category[] = []

// Returns when the guest finished each category, by category id.
export async function loadCategories(): Promise<Record<string, string>> {
  const dtos = await fetchCategories()
  CATEGORIES = dtos.map(toCategory)
  return Object.fromEntries(dtos.flatMap((d) => (d.completedAt ? [[d.code, d.completedAt]] : [])))
}

// Finished tests across categories; one guest counts once per category.
export function totalTests(): number {
  return CATEGORIES.reduce((sum, c) => sum + c.participants, 0)
}

export function findCategory(id: string | undefined): Category | undefined {
  return CATEGORIES.find((c) => c.id === id)
}

// Bit n is 1 when question n+1 was answered with B.
export function toAnswerBits(answers: Choice[]): number {
  return answers.reduce((acc, c, i) => (c === 'b' ? acc | (1 << i) : acc), 0)
}

export function fromAnswerBits(bits: number): Choice[] {
  return Array.from({ length: QUESTION_COUNT }, (_, i): Choice => (bits & (1 << i) ? 'b' : 'a'))
}

// "음식 취향" → "음식", for chart axes and short lists
export function shortName(category: Category): string {
  return category.name.replace(/ 취향$/, '')
}
