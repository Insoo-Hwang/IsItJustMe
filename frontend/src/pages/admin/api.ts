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
}

export const PERIODS = [7, 14, 30, 90] as const

export async function fetchDashboard(token: string, days: number): Promise<Dashboard> {
  const res = await fetch(`/api/v1/admin/dashboard?days=${days}`, { headers: { 'X-Admin-Token': token } })
  if (!res.ok) throw new HttpError(res.status, `dashboard failed: ${res.status}`)
  return res.json() as Promise<Dashboard>
}

export type AdStat = {
  // empty on the row of every ad together
  ad: string | null
  views: number
  // visitors who saw it at least once
  reach: number
  clicks: number
  // visitors who opened it at least once
  clickers: number
  skips: number
  // views in the one placement with a skip button: the base of the skip rate
  skippableViews: number
  previousViews: number
  previousClicks: number
}

// ad actions grouped by one key: a category code, an hour "0" to "23", or a placement
export type AdSlice = { key: string; views: number; clicks: number; skips: number }

export type AdReport = {
  generatedAt: string
  days: number
  ad: string | null
  ads: AdStat[]
  total: AdStat
  daily: { date: string; views: number; clicks: number; skips: number }[]
  audiences: { gender: string; ageGroup: string; views: number; clicks: number; skips: number }[]
  categories: AdSlice[]
  hours: AdSlice[]
  placements: AdSlice[]
  // every ad in every placement, the selection aside
  matrix: { ad: string; placement: string; views: number; clicks: number }[]
  // visitor and test pairs whose test the mid-test ad interrupted, and how many finished it
  retention: { viewed: number; finished: number }
}

export async function fetchAdReport(token: string, days: number, ad: string | null): Promise<AdReport> {
  const query = new URLSearchParams({ days: String(days) })
  if (ad) query.set('ad', ad)
  const res = await fetch(`/api/v1/admin/ads?${query}`, { headers: { 'X-Admin-Token': token } })
  if (!res.ok) throw new HttpError(res.status, `ad report failed: ${res.status}`)
  return res.json() as Promise<AdReport>
}

export type Maintenance = {
  enabled: boolean
  message: string
  // when maintenance started; null while the site is open
  since: string | null
}

export async function fetchMaintenance(token: string): Promise<Maintenance> {
  const res = await fetch('/api/v1/admin/maintenance', { headers: { 'X-Admin-Token': token } })
  if (!res.ok) throw new HttpError(res.status, `maintenance failed: ${res.status}`)
  return res.json() as Promise<Maintenance>
}

export async function saveMaintenance(token: string, enabled: boolean, message: string): Promise<Maintenance> {
  const res = await fetch('/api/v1/admin/maintenance', {
    method: 'PUT',
    headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled, message }),
  })
  if (!res.ok) throw new HttpError(res.status, `maintenance save failed: ${res.status}`)
  return res.json() as Promise<Maintenance>
}
