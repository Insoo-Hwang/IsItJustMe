import { useSyncExternalStore } from 'react'

let message: string | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function emit(next: string | null) {
  message = next
  listeners.forEach((l) => l())
}

export function showToast(text: string) {
  clearTimeout(timer)
  emit(text)
  timer = setTimeout(() => emit(null), 1800)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useToastMessage(): string | null {
  return useSyncExternalStore(subscribe, () => message)
}
