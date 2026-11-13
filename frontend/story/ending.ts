// Puts the ending together from STORY.md chapter 4: which memories come up, the dialogue
// and the letter. Pure functions, so the same answers always give the same ending.

import type { Guess, Line, Self, Side, Story, Tone } from './parse.ts'

// The guest's answer to one memory question.
export type MemoryAnswer = {
  category: string
  side: Side
  // % of participants who made the same pick
  rate: number
}

export type MemoryPick = { category: string; side: Side }

export type EndingPlan = {
  // memories talked about, in order
  scenes: MemoryPick[]
  // the combo dialogue after the scenes, if one matched
  combo: string | null
  // memories only mentioned in the letter
  letter: MemoryPick[]
}

export type Letter = {
  title: string
  paragraphs: string[]
  signature: string
  last: string
}

const SCENES = 2
const LETTER_MEMORIES = 2

const pick = ({ category, side }: MemoryAnswer): MemoryPick => ({ category, side })

// Rarest first; ties keep the order of the memory table, so without stats (all 50%)
// the table order decides.
function byRate(answers: MemoryAnswer[], story: Story): MemoryAnswer[] {
  const order = story.memoryQuestions.map((q) => q.category)
  return [...answers].sort((x, y) => x.rate - y.rate || order.indexOf(x.category) - order.indexOf(y.category))
}

// Combos whose two conditions both match the answers, in table order.
export function matchingCombos(story: Story, answers: MemoryAnswer[]) {
  const sideOf = new Map(answers.map((a) => [a.category, a.side]))
  return story.combos.filter((c) => c.when.every((w) => sideOf.get(w.category) === w.side))
}

// One of the matching combos, picked by `random` (0 <= random < 1), its categories becoming
// the scenes. Without one, the two rarest picks. The letter mentions the rarest of the rest.
// The same answers and the same random number give the same plan.
export function planEnding(story: Story, answers: MemoryAnswer[], random = 0): EndingPlan {
  const matches = matchingCombos(story, answers)
  const combo = matches.length > 0 ? matches[Math.min(matches.length - 1, Math.floor(random * matches.length))] : undefined
  const scenes = combo ? combo.when.map((w) => ({ category: w.category, side: w.side })) : byRate(answers, story).slice(0, SCENES).map(pick)
  const shown = new Set(scenes.map((s) => s.category))
  const letter = byRate(
    answers.filter((a) => !shown.has(a.category)),
    story,
  )
    .slice(0, LETTER_MEMORIES)
    .map(pick)
  return { scenes, combo: combo?.id ?? null, letter }
}

// Same memory answers give the same key, so a saved plan can be reused.
export function memoryKey(answers: MemoryAnswer[]): string {
  return answers.map((a) => `${a.category}:${a.side}`).join(',')
}

function comboOf(story: Story, id: string | null) {
  return id == null ? undefined : story.combos.find((c) => c.id === id)
}

// From the greeting to the tier dialogue, up to the last question.
export function talkLines(story: Story, tone: Tone, guess: Guess, plan: EndingPlan): Line[] {
  return [
    ...story.greetings[guess].talk,
    ...plan.scenes.flatMap((s) => story.memories[s.category][s.side].talk),
    ...(comboOf(story, plan.combo)?.talk ?? []),
    ...story.memoryClosing,
    ...story.endings[tone].talk,
  ]
}

// After the last question: the answer, goodbye and the narration before the letter.
export function afterLines(story: Story, self: Self): Line[] {
  return [...story.answers[self].talk, ...story.farewell, ...story.beforeLetter]
}

export function letterOf(story: Story, tone: Tone, guess: Guess, self: Self, plan: EndingPlan): Letter {
  const ending = story.endings[tone]
  const combo = comboOf(story, plan.combo)
  const memories = [...plan.letter.map((m) => story.memories[m.category][m.side].letter), ...(combo ? [combo.letter] : [])]
  // the last of several reads on from the ones before it
  if (memories.length > 1) memories[memories.length - 1] = `그리고 ${memories[memories.length - 1]}`
  return {
    title: ending.title,
    paragraphs: [
      ...ending.opening,
      story.greetings[guess].letter,
      ...ending.middle,
      ...(memories.length > 0 ? [story.join.memoryLead, ...memories] : []),
      ...ending.closing,
      `${story.answers[self].letter} ${ending.self[self]}`,
      story.join.goodbye,
    ],
    signature: story.join.signature,
    last: ending.last,
  }
}
