export type GuestSession = {
  issued: boolean
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
