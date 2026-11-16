import { HttpError, withGuest } from './categories.ts'

export type MvpDto = {
  // whether the overall numbers are hidden right now
  locked: boolean
  // guests who must finish every test before the numbers open
  goal: number
  // guests who finished every test
  completers: number
}

export async function fetchMvp(): Promise<MvpDto> {
  const res = await fetch('/api/v1/mvp')
  if (!res.ok) throw new HttpError(res.status, `mvp failed: ${res.status}`)
  return res.json() as Promise<MvpDto>
}

export async function saveNotifyEmail(email: string): Promise<void> {
  const res = await withGuest(() =>
    fetch('/api/v1/mvp/email', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
  )
  if (!res.ok) throw new HttpError(res.status, `email failed: ${res.status}`)
}
