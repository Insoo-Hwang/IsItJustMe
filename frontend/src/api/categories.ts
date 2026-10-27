import type { GuestProfile } from '../lib/profile.ts'
import { ensureGuestSession, resetGuestSession } from './guest.ts'

export type QuestionDto = {
  code: string
  prompt: string
  option0: string
  option1: string
  // % of all answers that picked option 0
  option0Rate: number
}

export type CategoryDto = {
  code: string
  name: string
  icon: string
  description: string
  tagline: string
  minutes: number
  recommend: string[]
  participants: number
  questions: QuestionDto[]
}

export type SummaryDto = {
  participants: number
  // other participants with identical answers
  exact: number
  // % of other participants matching at least 8 of 10 answers
  similar: number
  // % of other participants matching at most 2 of 10 answers
  opposite: number
  // other participants with every answer the other way
  different: number
}

export type ResultDto = {
  answerBits: number
  overall: SummaryDto
  peer: { profile: GuestProfile; summary: SummaryDto }
  questions: QuestionDto[]
}

export type GroupCountDto = {
  gender: GuestProfile['gender']
  ageGroup: GuestProfile['ageGroup']
  // answers in the group that picked option 0
  option0: number
  total: number
}

export type QuestionStatsDto = {
  answerBits: number
  questions: { code: string; prompt: string; option0: string; option1: string; groups: GroupCountDto[] }[]
}

export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Sends a guest request; on 401 gets a fresh session and retries once.
async function withGuest(request: () => Promise<Response>): Promise<Response> {
  await ensureGuestSession()
  let res = await request()
  if (res.status === 401) {
    resetGuestSession()
    await ensureGuestSession()
    res = await request()
  }
  return res
}

export async function fetchCategories(): Promise<CategoryDto[]> {
  const res = await fetch('/api/v1/categories')
  if (!res.ok) throw new HttpError(res.status, `categories failed: ${res.status}`)
  return res.json() as Promise<CategoryDto[]>
}

export async function submitAnswer(code: string, answerBits: number): Promise<void> {
  const res = await withGuest(() =>
    fetch(`/api/v1/categories/${code}/answer`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerBits }),
    }),
  )
  if (!res.ok) throw new HttpError(res.status, `submit answer failed: ${res.status}`)
}

export async function fetchResult(code: string): Promise<ResultDto> {
  const res = await withGuest(() => fetch(`/api/v1/categories/${code}/result`, { credentials: 'same-origin' }))
  if (!res.ok) throw new HttpError(res.status, `result failed: ${res.status}`)
  return res.json() as Promise<ResultDto>
}

export async function fetchQuestionStats(code: string): Promise<QuestionStatsDto> {
  const res = await withGuest(() =>
    fetch(`/api/v1/categories/${code}/result/questions`, { credentials: 'same-origin' }),
  )
  if (!res.ok) throw new HttpError(res.status, `question stats failed: ${res.status}`)
  return res.json() as Promise<QuestionStatsDto>
}
