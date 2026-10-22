import type { GuestProfile } from '../lib/profile.ts'

export type GuestSession = {
  issued: boolean
  profile: GuestProfile | null
}

let sessionRequest: Promise<GuestSession> | null = null

// Shared so concurrent callers (e.g. StrictMode double effects) don't issue two guests.
export function ensureGuestSession(): Promise<GuestSession> {
  sessionRequest ??= fetch('/api/v1/guests/session', {
    method: 'POST',
    credentials: 'same-origin',
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`guest session failed: ${res.status}`)
      }
      return res.json() as Promise<GuestSession>
    })
    .catch((err: unknown) => {
      sessionRequest = null
      throw err
    })
  return sessionRequest
}

function putProfile(profile: GuestProfile): Promise<Response> {
  return fetch('/api/v1/guests/profile', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
}

export async function saveProfile(profile: GuestProfile): Promise<void> {
  await ensureGuestSession()
  let res = await putProfile(profile)
  if (res.status === 401) {
    // cookie expired or guest was cleaned up: get a fresh session and retry once
    sessionRequest = null
    await ensureGuestSession()
    res = await putProfile(profile)
  }
  if (!res.ok) {
    throw new Error(`save profile failed: ${res.status}`)
  }
}
