import type { Choice } from '../data/categories.ts'
import { withRang, withTopic } from './korean.ts'
import { NAME_MAX_LENGTH } from './room.ts'

// The sharer's pick and name ride in the link; nothing is saved on the server.
export function debatePath(categoryId: string, n: number, pick: Choice, name: string): string {
  const query = new URLSearchParams({ pick, name })
  return `/vs/${categoryId}/${n}?${query}`
}

export function parseDebate(search: URLSearchParams): { pick: Choice; name: string } | null {
  const pick = search.get('pick')
  const name = search.get('name')?.trim()
  if ((pick !== 'a' && pick !== 'b') || !name || name.length > NAME_MAX_LENGTH) return null
  return { pick, name }
}

type Values = { name: string; prompt: string; a: string; b: string; choice: string; rate: number }

// Fills the placeholders of a STORY.md 3-5 line.
export function fillDebate(line: string, { name, prompt, a, b, choice, rate }: Values): string {
  return line
    .replaceAll('{이름은}', withTopic(name))
    .replaceAll('{이름이랑}', withRang(name))
    .replaceAll('{이름}', name)
    .replaceAll('{질문}', prompt)
    .replaceAll('{선택}', choice)
    .replaceAll('{A}', a)
    .replaceAll('{B}', b)
    .replaceAll('{비율}', String(Math.round(rate)))
}
