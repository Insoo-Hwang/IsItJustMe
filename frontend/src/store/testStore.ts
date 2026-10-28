import { useSyncExternalStore } from 'react'
import { QUESTION_COUNT, type Choice } from '../data/categories.ts'
import type { GuestProfile } from '../lib/profile.ts'

export type Answers = (Choice | null)[]

export type SavedResult = {
  completedAt: string
}

export type TestState = {
  // in-progress answers per category
  answers: Record<string, Answers>
  // categories finished on the server, synced on start
  results: Record<string, SavedResult>
  // copy of the profile saved on the guest, for showing it without a round trip
  profile: GuestProfile | null
}

const KEY = 'rarity-test-v1'
const EMPTY: TestState = { answers: {}, results: {}, profile: null }

function load(): TestState {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<TestState>
    return { ...EMPTY, ...saved }
  } catch {
    return EMPTY
  }
}

let state = load()
const listeners = new Set<() => void>()

function setState(update: (s: TestState) => TestState) {
  state = update(state)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage full or blocked: keep the in-memory state
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTestState(): TestState {
  return useSyncExternalStore(subscribe, () => state)
}

// for timers and handlers that must see the latest state, not the render-time one
export function getTestState(): TestState {
  return state
}

export function answeredCount(answers: Answers | undefined): number {
  return (answers ?? []).filter((c) => c != null).length
}

export function firstUnanswered(answers: Answers | undefined): number {
  for (let i = 0; i < QUESTION_COUNT; i++) {
    if (answers?.[i] == null) return i
  }
  return -1
}

export function setAnswer(catId: string, index: number, choice: Choice) {
  setState((s) => {
    const next = [...(s.answers[catId] ?? [])]
    next[index] = choice
    return { ...s, answers: { ...s.answers, [catId]: next } }
  })
}

export function clearAnswers(catId: string) {
  setState((s) => {
    const answers = { ...s.answers }
    delete answers[catId]
    return { ...s, answers }
  })
}

// Moves the finished answers into results. Returns false if any answer is missing.
export function completeTest(catId: string): boolean {
  const current = state.answers[catId] ?? []
  if (firstUnanswered(current) !== -1) return false
  setState((s) => {
    const answers = { ...s.answers }
    delete answers[catId]
    return { ...s, answers, results: { ...s.results, [catId]: { completedAt: new Date().toISOString() } } }
  })
  return true
}

// The server decides what is finished: this device may have finished tests as another
// guest (expired cookie) or before answers were saved on the server.
export function syncResults(completed: Record<string, string>) {
  setState((s) => ({
    ...s,
    results: Object.fromEntries(Object.entries(completed).map(([id, completedAt]) => [id, { completedAt }])),
  }))
}

export function setProfile(profile: GuestProfile | null) {
  setState((s) => ({ ...s, profile }))
}
