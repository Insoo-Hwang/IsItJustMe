import type { AdPlacement } from './ads.ts'

// Actions reported for the admin dashboard. The names match the server's EventType.
export type EventType =
  | 'AD_VIEW'
  | 'AD_CLICK'
  | 'AD_SKIP'
  | 'SHARE_UNIVERSE'
  | 'SHARE_DEBATE'
  | 'SHARE_KAKAO'
  | 'INVITE_OPEN'
  | 'DEBATE_OPEN'
  | 'DEBATE_PICK'
  | 'CARD_SAVE'
  | 'ENDING_OPEN'

// The ad an ad action was about and the spot it was shown in.
export type AdRef = { id: string; placement: AdPlacement }

const OFF_KEY = 'track-off'

// The operator's own browsing would mix into the numbers advertisers see, so a browser
// that signed in to the admin page stops reporting (switchable on the admin page).
export function trackingOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === '1'
  } catch {
    return false
  }
}

export function setTrackingOff(off: boolean) {
  try {
    if (off) localStorage.setItem(OFF_KEY, '1')
    else localStorage.removeItem(OFF_KEY)
  } catch {
    // storage blocked: this browser keeps reporting
  }
}

// Fire and forget: nothing on the page depends on it, and a failure must not disturb the
// visitor. keepalive lets it finish even if the page is left right after.
export function track(type: EventType, category?: string, ad?: AdRef) {
  if (trackingOff()) return
  fetch('/api/v1/events', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, category, ad: ad?.id, placement: ad?.placement }),
  }).catch(() => {})
}

const sent = new Set<string>()

// For "this was shown" events: once per page load for the same key, however often the
// component re-renders or its effect runs again.
export function trackOnce(key: string, type: EventType, category?: string, ad?: AdRef) {
  if (sent.has(key)) return
  sent.add(key)
  track(type, category, ad)
}
