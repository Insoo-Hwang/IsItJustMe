import { HttpError } from '../../api/categories.ts'

export type Change = { current: number; previous: number }

export type Day = {
  date: string
  guests: number
  answers: number
  finished: number
  rooms: number
  planets: number
  // actions by event type; types with no action that day are missing
  events: Record<string, number>
}

export type Dashboard = {
  generatedAt: string
  days: number
  totals: {
    guests: number
    profiled: number
    started: number
    finished: number
    answers: number
    rooms: number
    planets: number
    roomsWithPlanets: number
  }
  // counts inside the period and in the same-length period before it
  period: Record<string, Change>
  daily: Day[]
  funnel: { key: string; count: number }[]
  // guests by how many categories they finished, index 0 to the category count
  progress: number[]
  categories: { code: string; name: string; participants: number; firstPicks: number }[]
  demographics: { gender: string; ageGroup: string; guests: number; finished: number }[]
  // category completions of the period by hour of day, 24 entries
  hours: number[]
  questions: {
    category: string
    number: number
    prompt: string
    option0: string
    option1: string
    option0Count: number
    total: number
  }[]
  ads: { category: string; views: number; clicks: number; skips: number }[]
}

export const PERIODS = [7, 14, 30, 90] as const

export async function fetchDashboard(token: string, days: number): Promise<Dashboard> {
  const res = await fetch(`/api/v1/admin/dashboard?days=${days}`, { headers: { 'X-Admin-Token': token } })
  if (!res.ok) throw new HttpError(res.status, `dashboard failed: ${res.status}`)
  return res.json() as Promise<Dashboard>
}
