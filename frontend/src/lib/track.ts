// Actions reported for the admin dashboard. The names match the server's EventType.
export type EventType =
  | 'AD_VIEW'
  | 'AD_CLICK'
  | 'AD_SKIP'
  | 'SHARE_UNIVERSE'
  | 'SHARE_DEBATE'
  | 'INVITE_OPEN'
  | 'DEBATE_OPEN'
  | 'DEBATE_PICK'
  | 'CARD_SAVE'
  | 'ENDING_OPEN'

// Fire and forget: nothing on the page depends on it, and a failure must not disturb the
// visitor. keepalive lets it finish even if the page is left right after.
export function track(type: EventType, category?: string) {
  fetch('/api/v1/events', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, category }),
  }).catch(() => {})
}

const sent = new Set<string>()

// For "this was shown" events: once per page load for the same key, however often the
// component re-renders or its effect runs again.
export function trackOnce(key: string, type: EventType, category?: string) {
  if (sent.has(key)) return
  sent.add(key)
  track(type, category)
}
