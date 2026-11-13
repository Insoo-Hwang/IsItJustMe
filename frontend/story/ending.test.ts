// node --test story/  (Node 24 runs TypeScript as is)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { afterLines, letterOf, matchingCombos, memoryKey, planEnding, talkLines, type MemoryAnswer } from './ending.ts'
import { parseStory, type Guess, type Self, type Side, type Tone } from './parse.ts'

const MD = readFileSync(new URL('../../STORY.md', import.meta.url), 'utf8')
const story = parseStory(MD)

const CATEGORIES = ['food', 'life', 'spending', 'travel', 'people', 'love']
const TONES: Tone[] = ['rare', 'unique', 'firm', 'common']
const GUESSES: Guess[] = ['same', 'different', 'unsure']
const SELVES: Self[] = ['yes', 'no', 'unsure']

// Written from the plan document, not from STORY.md, so a swapped side there fails here.
// When several match, one is picked at random.
const SPEC_COMBOS: [string, [string, Side], [string, Side]][] = [
  ['COMBO_01', ['travel', 'b'], ['love', 'b']],
  ['COMBO_03', ['life', 'a'], ['people', 'a']],
  ['COMBO_06', ['love', 'a'], ['spending', 'b']],
  ['COMBO_02', ['food', 'a'], ['travel', 'b']],
  ['COMBO_08', ['spending', 'b'], ['travel', 'b']],
  ['COMBO_05', ['food', 'b'], ['people', 'b']],
  ['COMBO_04', ['spending', 'a'], ['travel', 'a']],
  ['COMBO_07', ['food', 'a'], ['people', 'b']],
]

// What each memory paragraph must say for the side picked.
const SIDE_WORDS: Record<string, Record<Side, string>> = {
  food: { a: '익숙한 맛을 골랐', b: '새로운 맛을 골랐' },
  life: { a: '혼자만의 시간을 골랐', b: '함께하는 시간을 골랐' },
  spending: { a: '지금의 행복을 선택', b: '나중을 위한 선택' },
  travel: { a: '미리 계획하는 여행을 골랐', b: '발길 닿는 대로 떠나는 여행을 골랐' },
  people: { a: '먼저 다가가는 쪽을 골랐', b: '천천히 가까워지는 쪽을 골랐' },
  love: { a: '먼저 표현하는 쪽을 골랐', b: '기다리는 쪽을 골랐' },
}

// The 64 ways to answer the six memory questions, all at 50%.
function allAnswers(rates: Record<string, number> = {}): MemoryAnswer[][] {
  return Array.from({ length: 64 }, (_, bits) =>
    CATEGORIES.map((category, i) => ({ category, side: (bits >> i) & 1 ? 'b' : 'a', rate: rates[category] ?? 50 }) as MemoryAnswer),
  )
}

const sentences = (text: string) =>
  text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

test('memory questions match chapter 5, A and B not swapped', () => {
  assert.deepEqual(
    story.memoryQuestions.map((q) => q.category),
    CATEGORIES,
  )
  assert.deepEqual(
    story.memoryQuestions.map((q) => q.question),
    CATEGORIES.map((c) => `${c}-11`),
  )
  const swapped = MD.replace('| `food` | `food-11` | 늘 먹던 익숙한 맛 | 새로운 맛에 도전 |', '| `food` | `food-11` | 새로운 맛에 도전 | 늘 먹던 익숙한 맛 |')
  assert.notEqual(swapped, MD)
  assert.throws(() => parseStory(swapped), /A · B가 바뀌지 않았는지/)
})

test('each memory paragraph talks about the side picked', () => {
  for (const category of CATEGORIES) {
    for (const side of ['a', 'b'] as Side[]) {
      const letter = story.memories[category][side].letter
      assert.ok(letter.includes(SIDE_WORDS[category][side]), `${category} ${side}: ${letter}`)
      assert.ok(letter.startsWith('너는 '), `${category} ${side} starts with 너는`)
    }
  }
})

test('combos match the plan document', () => {
  assert.deepEqual(
    story.combos.map((c) => [c.id, ...c.when.map((w) => [w.category, w.side])]),
    SPEC_COMBOS,
  )
  for (const c of story.combos) assert.ok(c.letter.startsWith('너는 '), c.id)
})

// random numbers that land on each of n matching combos
const picks = (n: number) => Array.from({ length: Math.max(n, 1) }, (_, i) => (i + 0.5) / Math.max(n, 1))

test('any matching combo can come up, its categories becoming the scenes', () => {
  const seen = new Set<string>()
  for (const answers of allAnswers()) {
    const side = new Map(answers.map((a) => [a.category, a.side]))
    const expected = SPEC_COMBOS.filter(([, x, y]) => side.get(x[0]) === x[1] && side.get(y[0]) === y[1])
    assert.deepEqual(
      matchingCombos(story, answers).map((c) => c.id),
      expected.map(([id]) => id),
      memoryKey(answers),
    )
    expected.forEach(([id, x, y], i) => {
      const plan = planEnding(story, answers, (i + 0.5) / expected.length)
      assert.equal(plan.combo, id)
      assert.deepEqual(plan.scenes, [x, y].map(([category, s]) => ({ category, side: s })))
      seen.add(id)
    })
    // the edges of the random range stay inside the list
    assert.equal(planEnding(story, answers, 0).combo, expected[0]?.[0] ?? null)
    assert.equal(planEnding(story, answers, 0.999999).combo, expected.at(-1)?.[0] ?? null)
    // same answers and number, same plan
    assert.deepEqual(planEnding(story, answers, 0.42), planEnding(story, answers, 0.42))
  }
  assert.deepEqual([...seen].sort(), SPEC_COMBOS.map(([id]) => id).sort(), 'every combo can come up')
})

test('flipping one side of a combo stops it from matching', () => {
  for (const [id, x, y] of SPEC_COMBOS) {
    for (const flip of [x, y]) {
      for (const a of allAnswers()) {
        const side = new Map(a.map((m) => [m.category, m.side]))
        if (side.get(x[0]) !== x[1] || side.get(y[0]) !== y[1]) continue
        const flipped = a.map((m) => (m.category === flip[0] ? { ...m, side: (m.side === 'a' ? 'b' : 'a') as Side } : m))
        assert.ok(!matchingCombos(story, flipped).some((c) => c.id === id))
      }
    }
  }
})

test('without a combo the rarest two are the scenes, ties in table order', () => {
  const none = allAnswers().filter((a) => planEnding(story, a).combo == null)
  assert.ok(none.length > 0)
  for (const base of none) {
    // no stats: table order
    assert.deepEqual(
      planEnding(story, base).scenes.map((s) => s.category),
      ['food', 'life'],
    )
    const rated = base.map((a) => ({ ...a, rate: { love: 12, travel: 30, people: 30, food: 70 }[a.category] ?? 50 }))
    const plan = planEnding(story, rated)
    assert.deepEqual(
      plan.scenes.map((s) => s.category),
      ['love', 'travel'],
    )
    assert.deepEqual(
      plan.letter.map((s) => s.category),
      ['people', 'life'],
    )
  }
})

test('the letter mentions two memories that were not talked about', () => {
  for (const answers of allAnswers({ love: 10, people: 20 })) {
    const plan = planEnding(story, answers)
    assert.equal(plan.scenes.length, 2)
    assert.equal(plan.letter.length, 2)
    const shown = plan.scenes.map((s) => s.category)
    for (const m of plan.letter) {
      assert.ok(!shown.includes(m.category))
      assert.equal(m.side, answers.find((a) => a.category === m.category)!.side)
    }
  }
})

test('missing memory answers still give an ending', () => {
  const plan = planEnding(story, [{ category: 'food', side: 'a', rate: 40 }])
  assert.deepEqual(plan, { scenes: [{ category: 'food', side: 'a' }], combo: null, letter: [] })
  const letter = letterOf(story, 'rare', 'same', 'yes', planEnding(story, []))
  assert.ok(!letter.paragraphs.includes(story.join.memoryLead))
})

test('every combination builds the same letter twice, in order, without repeated sentences', () => {
  for (const tone of TONES) {
    for (const guess of GUESSES) {
      for (const self of SELVES) {
        for (const answers of allAnswers({ people: 20, love: 35 })) {
          for (const r of picks(matchingCombos(story, answers).length)) {
            const plan = planEnding(story, answers, r)
            const letter = letterOf(story, tone, guess, self, plan)
            assert.deepEqual(letterOf(story, tone, guess, self, planEnding(story, answers, r)), letter)

            const ending = story.endings[tone]
            const p = letter.paragraphs
            assert.equal(letter.title, ending.title)
            assert.deepEqual(p.slice(0, ending.opening.length), ending.opening)
            assert.equal(p[ending.opening.length], story.greetings[guess].letter)
            assert.ok(p.at(-2)!.startsWith(story.answers[self].letter))
            assert.ok(p.at(-2)!.endsWith(ending.self[self]))
            assert.equal(p.at(-1), story.join.goodbye)
            assert.equal(letter.last, ending.last)

            const combo = story.combos.find((c) => c.id === plan.combo)
            const memoryCount = plan.letter.length + (combo ? 1 : 0)
            const lead = p.indexOf(story.join.memoryLead)
            assert.equal(p[lead - 1], ending.middle.at(-1))
            assert.equal(p[lead + memoryCount + 1], ending.closing[0])
            assert.ok(p[lead + memoryCount].startsWith('그리고 너는 '))
            if (combo) assert.ok(p[lead + memoryCount].endsWith(combo.letter))

            const all = [...p, letter.last].flatMap(sentences)
            const repeated = all.filter((s, i) => s.length > 12 && all.indexOf(s) !== i)
            assert.deepEqual(repeated, [], `${tone} ${guess} ${self} ${memoryKey(answers)} ${plan.combo}`)
          }
        }
      }
    }
  }
})

test('the dialogue has no repeated long line and ends with the narration', () => {
  for (const tone of TONES) {
    for (const guess of GUESSES) {
      for (const answers of allAnswers()) {
        for (const self of SELVES) {
          for (const r of picks(matchingCombos(story, answers).length)) {
            const lines = [...talkLines(story, tone, guess, planEnding(story, answers, r)), ...story.ask.talk, ...afterLines(story, self)]
            const texts = lines.map((l) => l.text).filter((t) => t.length > 12)
            assert.deepEqual(
              texts.filter((t, i) => texts.indexOf(t) !== i),
              [],
              `${tone} ${guess} ${self} ${memoryKey(answers)}`,
            )
            assert.equal(lines.at(-1)!.speaker, 'system')
          }
        }
      }
    }
  }
})

test('nothing guesses a past the guest never told', () => {
  const text = JSON.stringify([story.memories, story.combos, story.endings, story.answers, story.greetings])
  for (const word of ['따돌림', '외로웠', '상처받', '완벽주의', '왕따', '걱정이 많']) {
    assert.ok(!text.includes(word), word)
  }
})
