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

// Card colors are part of the design, so they stay here instead of the DB.
const TINTS: Record<string, Category['tint']> = {
  food: { bg: 'oklch(0.94 0.045 28)', fg: 'oklch(0.58 0.17 28)' },
  love: { bg: 'oklch(0.94 0.04 0)', fg: 'oklch(0.58 0.17 0)' },
  life: { bg: 'oklch(0.95 0.06 90)', fg: 'oklch(0.55 0.12 75)' },
  travel: { bg: 'oklch(0.94 0.035 230)', fg: 'oklch(0.55 0.13 230)' },
  music: { bg: 'oklch(0.94 0.04 300)', fg: 'oklch(0.55 0.15 300)' },
  people: { bg: 'oklch(0.94 0.045 150)', fg: 'oklch(0.52 0.12 150)' },
}

const DEFAULT_TINT: Category['tint'] = { bg: 'oklch(0.95 0.01 250)', fg: 'oklch(0.45 0.02 250)' }

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

export async function loadCategories(): Promise<void> {
  CATEGORIES = (await fetchCategories()).map(toCategory)
}

export function totalParticipants(): number {
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
