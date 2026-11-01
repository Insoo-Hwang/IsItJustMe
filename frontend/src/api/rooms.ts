import { HttpError, withGuest } from './categories.ts'

export type CategoryBitsDto = {
  code: string
  // bit n is 1 when question n+1 got option 1
  answerBits: number
}

export type RoomRole = 'OWNER' | 'MEMBER' | 'VISITOR'

export type RoomDto = {
  ownerName: string
  // the owner's answers in display order
  owner: CategoryBitsDto[]
  planets: number
  viewer: {
    role: RoomRole
    // answered every category
    complete: boolean
    // the viewer's planet, when the viewer joined
    planetId: number | null
  }
}

export type PlanetDto = {
  id: number
  name: string
  // % of all questions answered the same way as the owner
  match: number
  me: boolean
}

export type CategoryMatchDto = {
  code: string
  ownerBits: number
  otherBits: number
  // questions of the category answered the same way
  matched: number
}

// The owner compared with the viewer; nobody else's answers are ever sent.
export type ComparisonDto = {
  ownerName: string
  // null until the viewer joins the universe
  planetId: number | null
  planetName: string | null
  match: number
  categories: CategoryMatchDto[]
}

function postName(url: string, name: string): Promise<Response> {
  return withGuest(() =>
    fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  )
}

export async function openRoom(ownerName: string): Promise<string> {
  const res = await postName('/api/v1/rooms', ownerName)
  if (!res.ok) throw new HttpError(res.status, `open room failed: ${res.status}`)
  const body = (await res.json()) as { shareToken: string }
  return body.shareToken
}

export async function fetchRoom(token: string): Promise<RoomDto> {
  const res = await withGuest(() => fetch(`/api/v1/rooms/${token}`, { credentials: 'same-origin' }))
  if (!res.ok) throw new HttpError(res.status, `room failed: ${res.status}`)
  return res.json() as Promise<RoomDto>
}

export async function joinUniverse(token: string, planetName: string): Promise<number> {
  const res = await postName(`/api/v1/rooms/${token}/planets`, planetName)
  if (!res.ok) throw new HttpError(res.status, `join universe failed: ${res.status}`)
  const body = (await res.json()) as { planetId: number }
  return body.planetId
}

export async function fetchUniverse(token: string): Promise<PlanetDto[]> {
  const res = await withGuest(() => fetch(`/api/v1/rooms/${token}/universe`, { credentials: 'same-origin' }))
  if (!res.ok) throw new HttpError(res.status, `universe failed: ${res.status}`)
  const body = (await res.json()) as { planets: PlanetDto[] }
  return body.planets
}

export async function fetchComparison(token: string): Promise<ComparisonDto> {
  const res = await withGuest(() => fetch(`/api/v1/rooms/${token}/compare`, { credentials: 'same-origin' }))
  if (!res.ok) throw new HttpError(res.status, `comparison failed: ${res.status}`)
  return res.json() as Promise<ComparisonDto>
}
