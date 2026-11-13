// Reads the screen texts out of STORY.md (tiers, universe lines, the ending). No file
// access here, so the app can import the types too. Errors point at the line to fix.

export type Tone = 'rare' | 'unique' | 'firm' | 'common'

export type Speaker = 'system' | 'past' | 'now'

export type Guess = 'same' | 'different' | 'unsure'

export type Face = 'default' | 'smile' | 'surprised' | 'sad'

export type Line = { speaker: Speaker; face: Face; text: string }

export type Self = 'yes' | 'no' | 'unsure'

// the two options of a question, A = option0 and B = option1
export type Side = 'a' | 'b'

export type Ending = {
  no: string
  // dialogue title
  scene: string
  talk: Line[]
  // letter title
  title: string
  // the letter is put together around these parts, see STORY.md chapter 4
  opening: string[]
  middle: string[]
  closing: string[]
  // one sentence after the last question's paragraph
  self: Record<Self, string>
  last: string
}

// The memory question of a category (its question 10), recalled in the ending.
export type MemoryQuestion = { category: string; question: string; a: string; b: string }

export type Scene = { talk: Line[]; letter: string }

export type Combo = {
  id: string
  name: string
  // both must match, in the order the scenes are shown
  when: { category: string; side: Side }[]
  talk: Line[]
  letter: string
}

export type Tier = {
  // lowest share of minority picks, 0 to 1
  min: number
  tier: string
  tone: Tone
  headline: string
}

export type MatchLine = {
  // lowest match, in %
  min: number
  text: string
}

export type RankLine = {
  // highest "top n%" the line covers
  max: number
  text: string
}

export type Debate = {
  title: string
  taunt: string
  question: string
  same: string
  different: string
  testButton: string
  shareText: string
}

export type Story = {
  tiers: Tier[]
  matchLines: MatchLine[]
  rankLines: RankLine[]
  debate: Debate
  intro: Line[]
  guesses: { id: Guess; label: string }[]
  reveal: { name: string; text: string[]; button: string }
  greetings: Record<Guess, Scene>
  memoryQuestions: MemoryQuestion[]
  // by category, then by the side picked
  memories: Record<string, Record<Side, Scene>>
  // from the highest priority
  combos: Combo[]
  memoryClosing: Line[]
  endings: Record<Tone, Ending>
  ask: { talk: Line[]; choices: { id: Self; label: string }[] }
  answers: Record<Self, Scene>
  farewell: Line[]
  beforeLetter: Line[]
  join: { memoryLead: string; goodbye: string; signature: string; shareText: string }
}

const TONES: Tone[] = ['rare', 'unique', 'firm', 'common']
const GUESSES: Guess[] = ['same', 'different', 'unsure']
const SELVES: Self[] = ['yes', 'no', 'unsure']
const SIDES: Record<string, Side> = { A: 'a', B: 'b' }

// Narration shows no name on screen; STORY.md calls it 내레이션.
export const SPEAKER_NAMES: Record<Speaker, string> = {
  system: '',
  past: '어릴 적 나',
  now: '지금의 나',
}

const SPEAKERS: Record<string, Speaker> = { 내레이션: 'system', [SPEAKER_NAMES.past]: 'past', [SPEAKER_NAMES.now]: 'now' }

// Faces written as "화자(표정)"; a line without one shows the default face.
export const FACE_NAMES: Record<Speaker, Partial<Record<string, Face>>> = {
  system: {},
  past: { 웃음: 'smile', 놀람: 'surprised', 시무룩: 'sad' },
  now: { 미소: 'smile' },
}

type Text = { text: string; line: number }

type Section = { level: number; title: string; line: number; body: Text[]; children: Section[] }

function fail(line: number, message: string): never {
  throw new Error(`STORY.md:${line}: ${message}`)
}

function outline(md: string): Section {
  const root: Section = { level: 0, title: '', line: 1, body: [], children: [] }
  const open = [root]
  md.split(/\r?\n/).forEach((text, i) => {
    const heading = /^(#{1,6})\s+(.*)$/.exec(text)
    if (!heading) {
      open[open.length - 1].body.push({ text, line: i + 1 })
      return
    }
    const section: Section = { level: heading[1].length, title: heading[2].trim(), line: i + 1, body: [], children: [] }
    while (open[open.length - 1].level >= section.level) open.pop()
    open[open.length - 1].children.push(section)
    open.push(section)
  })
  return root
}

function child(parent: Section, title: string): Section {
  return parent.children.find((s) => s.title === title) ?? fail(parent.line, `"${title}" 제목이 없어요`)
}

// Rows under the header and separator, each with as many cells as the header.
function table(section: Section): { cells: string[]; line: number }[] {
  const rows = section.body
    .filter((t) => t.text.trim().startsWith('|'))
    .map((t) => ({ cells: t.text.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()), line: t.line }))
  if (rows.length < 3) fail(section.line, `"${section.title}"에 표가 없거나 비어 있어요`)
  const [header, , ...body] = rows
  for (const row of body) {
    if (row.cells.length !== header.cells.length) fail(row.line, `칸이 ${header.cells.length}개여야 해요`)
    if (row.cells.some((c) => c === '')) fail(row.line, '빈 칸이 있어요')
  }
  return body
}

function code(cell: string, line: number): string {
  return /^`([^`]+)`$/.exec(cell)?.[1] ?? fail(line, `${cell}: \`코드\` 형식이어야 해요`)
}

function items(section: Section): Text[] {
  return section.body.filter((t) => t.text.startsWith('- ')).map((t) => ({ text: t.text.slice(2).trim(), line: t.line }))
}

function pair(item: Text): [string, string] {
  const at = item.text.indexOf(':')
  if (at < 0) fail(item.line, '"이름: 내용" 형식이어야 해요')
  const value = item.text.slice(at + 1).trim()
  if (!value) fail(item.line, '내용이 비어 있어요')
  return [item.text.slice(0, at).trim(), value]
}

function lines(section: Section): Line[] {
  const talk = items(section).map((item) => {
    const [who, text] = pair(item)
    const [, name, faceName] = /^(.+?)(?:\((.+)\))?$/.exec(who)!
    const speaker = SPEAKERS[name] ?? fail(item.line, `화자 "${name}"은 ${Object.keys(SPEAKERS).join(', ')} 중 하나여야 해요`)
    const faces = FACE_NAMES[speaker]
    const face =
      faceName == null
        ? 'default'
        : (faces[faceName] ??
          fail(item.line, Object.keys(faces).length > 0 ? `${name}의 표정은 ${Object.keys(faces).join(', ')} 중 하나여야 해요` : `${name}은 표정을 쓸 수 없어요`))
    return { speaker, face, text }
  })
  return talk.length > 0 ? talk : fail(section.line, `"${section.title}"에 대사가 없어요`)
}

// "- 이름: 값" items by name; names in `many` may repeat, the others appear once.
function fields(section: Section, names: string[], many: string[] = []): Record<string, string[]> {
  const found: Record<string, string[]> = Object.fromEntries(names.map((n) => [n, []]))
  for (const item of items(section)) {
    const [name, value] = pair(item)
    if (!found[name]) fail(item.line, `"${name}"은 ${names.join(', ')} 중 하나여야 해요`)
    if (found[name].length > 0 && !many.includes(name)) fail(item.line, `"${name}"이 두 번 있어요`)
    found[name].push(value)
  }
  for (const name of names) {
    if (found[name].length === 0) fail(section.line, `"${section.title}"에 "${name}"이 없어요`)
  }
  return found
}

// "> 문단" lines, paragraphs split by a lone ">".
function paragraphs(section: Section): string[] {
  const result: string[] = []
  let current: string[] = []
  const flush = () => {
    if (current.length > 0) result.push(current.join(' '))
    current = []
  }
  for (const t of section.body) {
    if (!t.text.startsWith('>')) continue
    const text = t.text.slice(1).trim()
    if (text) current.push(text)
    else flush()
  }
  flush()
  return result.length > 0 ? result : fail(section.line, `"${section.title}"에 "> 문단"이 없어요`)
}

// "N% 이상" from high to low, then "그 외" last.
function thresholds(rows: { cells: string[]; line: number }[], column: number): number[] {
  return rows.map((row, i) => {
    const cell = row.cells[column]
    const last = i === rows.length - 1
    if (last) return cell === '그 외' ? 0 : fail(row.line, '마지막 줄의 기준은 "그 외"여야 해요')
    const percent = Number(/^(\d+)% 이상$/.exec(cell)?.[1] ?? fail(row.line, `${cell}: "N% 이상" 형식이어야 해요`))
    if (i > 0 && percent >= Number(/^(\d+)/.exec(rows[i - 1].cells[column])![1])) {
      fail(row.line, '기준은 위에서부터 높은 순이어야 해요')
    }
    return percent
  })
}

// Every key exactly once, from the keys found in the document.
function complete<K extends string, V>(found: Map<string, V>, keys: K[], line: number, what: string): Record<K, V> {
  const missing = keys.filter((k) => !found.has(k))
  if (missing.length > 0) fail(line, `${what}에 ${missing.join(', ')}이 없어요`)
  return Object.fromEntries(keys.map((k) => [k, found.get(k)!])) as Record<K, V>
}

function once<V>(found: Map<string, V>, key: string, value: V, line: number, allowed: string[]) {
  if (!allowed.includes(key)) fail(line, `${key}: ${allowed.join(', ')} 중 하나여야 해요`)
  if (found.has(key)) fail(line, `${key}가 두 번 있어요`)
  found.set(key, value)
}

function tiersOf(section: Section): Tier[] {
  const rows = table(section)
  const mins = thresholds(rows, 2)
  const found = new Map<string, Tier>()
  rows.forEach((row, i) => {
    const tone = code(row.cells[1], row.line)
    once(found, tone, { min: mins[i] / 100, tier: row.cells[0], tone: tone as Tone, headline: row.cells[3] }, row.line, TONES)
  })
  complete(found, TONES, section.line, '등급 표')
  return [...found.values()]
}

function matchLinesOf(section: Section): MatchLine[] {
  const rows = table(section)
  const mins = thresholds(rows, 0)
  return rows.map((row, i) => ({ min: mins[i], text: row.cells[1] }))
}

// "상위 N% 이내" from low to high, then "그 외" last.
function rankLinesOf(section: Section): RankLine[] {
  const rows = table(section)
  let previous = 0
  return rows.map((row, i) => {
    const cell = row.cells[0]
    if (i === rows.length - 1) {
      return cell === '그 외' ? { max: 100, text: row.cells[1] } : fail(row.line, '마지막 줄의 순위는 "그 외"여야 해요')
    }
    const max = Number(/^상위 (\d+)% 이내$/.exec(cell)?.[1] ?? fail(row.line, `${cell}: "상위 N% 이내" 형식이어야 해요`))
    if (max <= previous) fail(row.line, '순위는 위에서부터 낮은 순이어야 해요')
    previous = max
    return { max, text: row.cells[1] }
  })
}

function debateOf(section: Section): Debate {
  const f = fields(section, ['제목', '도발', '질문', '같은 편', '다른 편', '테스트 버튼', '공유 문구'])
  return {
    title: f['제목'][0],
    taunt: f['도발'][0],
    question: f['질문'][0],
    same: f['같은 편'][0],
    different: f['다른 편'][0],
    testButton: f['테스트 버튼'][0],
    shareText: f['공유 문구'][0],
  }
}


// Exactly one "> 문단" paragraph.
function paragraph(section: Section): string {
  const found = paragraphs(section)
  return found.length === 1 ? found[0] : fail(section.line, `"${section.title}"의 편지 문단은 하나여야 해요`)
}

function scene(section: Section): Scene {
  return { talk: lines(section), letter: paragraph(section) }
}

// "| id | 선택지 |" rows with `code` ids, each of the allowed ids once.
function choicesOf<K extends string>(section: Section, ids: K[]): { id: K; label: string }[] {
  const rows = table(section)
  const found = new Map<string, string>()
  for (const row of rows) once(found, code(row.cells[0], row.line), row.cells[1], row.line, ids)
  complete(found, ids, section.line, `"${section.title}"`)
  return rows.map((row) => ({ id: code(row.cells[0], row.line) as K, label: row.cells[1] }))
}

// "`food` A" in a combo condition.
function condition(text: string, line: number): { category: string; side: Side } {
  const match = /^`(\w+)` ([AB])$/.exec(text.trim()) ?? fail(line, `${text}: "\`카테고리\` A" 형식이어야 해요`)
  return { category: match[1], side: SIDES[match[2]] }
}

// Option texts of each category's questions in chapter 5, to check the memory questions.
function questionOptions(chapter: Section): Map<string, [string, string][]> {
  const options = new Map<string, [string, string][]>()
  for (const s of chapter.children) {
    const category = /^`(\w+)`/.exec(s.title)?.[1]
    if (category) options.set(category, table(s).map((row) => [row.cells[2], row.cells[3]]))
  }
  return options
}

function endingOf(section: Section, options: Map<string, [string, string][]>): Omit<Story, 'tiers' | 'matchLines' | 'rankLines' | 'debate'> {
  const reveal = fields(child(section, '공개'), ['이름', '문구', '버튼'], ['문구'])

  const memorySection = child(section, '회상 문항')
  const memoryQuestions = table(memorySection).map((row): MemoryQuestion => {
    const [category, question] = [code(row.cells[0], row.line), code(row.cells[1], row.line)]
    const [a, b] = [row.cells[2], row.cells[3]]
    const questions = options.get(category) ?? fail(row.line, `5장에 \`${category}\` 문항 표가 없어요`)
    if (!questions.some(([qa, qb]) => qa === a && qb === b)) {
      fail(row.line, `5장의 \`${category}\` 문항 중에 A "${a}", B "${b}"인 문항이 없어요 (A · B가 바뀌지 않았는지 확인)`)
    }
    return { category, question, a, b }
  })
  const categories = memoryQuestions.map((q) => q.category)
  if (new Set(categories).size !== categories.length) fail(memorySection.line, '회상 문항의 카테고리가 겹쳐요')

  const comboSection = child(section, '연결 대화')
  const comboRows = table(comboSection).map((row) => {
    const id = /^COMBO (\d+)$/.exec(row.cells[0])?.[1] ?? fail(row.line, `${row.cells[0]}: "COMBO 01" 형식이어야 해요`)
    const when = row.cells[1].split('·').map((c) => condition(c, row.line))
    if (when.length !== 2 || when[0].category === when[1].category) fail(row.line, '조건은 서로 다른 카테고리 두 개여야 해요')
    for (const c of when) {
      if (!categories.includes(c.category)) fail(row.line, `\`${c.category}\`는 회상 문항에 없는 카테고리예요`)
    }
    return { id, when, line: row.line }
  })

  const greetings = new Map<string, Scene>()
  const memories = new Map<string, Map<string, Scene>>(categories.map((c) => [c, new Map()]))
  const combos = new Map<string, Omit<Combo, 'when'>>()
  const endings = new Map<string, Ending>()
  const answers = new Map<string, Scene>()
  for (const s of section.children) {
    const greeting = /^첫 인사 · `(\w+)`$/.exec(s.title)
    if (greeting) once(greetings, greeting[1], scene(s), s.line, GUESSES)
    const memory = /^회상 · `(\w+)` · ([AB])$/.exec(s.title)
    if (memory) {
      const sides = memories.get(memory[1]) ?? fail(s.line, `\`${memory[1]}\`는 회상 문항에 없는 카테고리예요`)
      once(sides, SIDES[memory[2]], scene(s), s.line, ['a', 'b'])
    }
    const combo = /^COMBO (\d+) · (.+)$/.exec(s.title)
    if (combo) {
      once(combos, combo[1], { id: `COMBO_${combo[1]}`, name: combo[2], ...scene(s) }, s.line, comboRows.map((r) => r.id))
    }
    const answer = /^마지막 질문 · `(\w+)`$/.exec(s.title)
    if (answer) once(answers, answer[1], scene(s), s.line, SELVES)
    const ending = /^ENDING (\d+) · `(\w+)`$/.exec(s.title)
    if (ending) {
      const f = fields(s, ['대화 제목', '편지 제목', '마지막 문장'])
      const self = new Map(items(child(s, '편지 · 마음')).map((item) => {
        const [key, text] = pair(item)
        return [code(key, item.line), text] as const
      }))
      once(
        endings,
        ending[2],
        {
          no: ending[1],
          scene: f['대화 제목'][0],
          talk: lines(child(s, '대화')),
          title: f['편지 제목'][0],
          opening: paragraphs(child(s, '편지 · 도입')),
          middle: paragraphs(child(s, '편지 · 중간')),
          closing: paragraphs(child(s, '편지 · 마무리')),
          self: complete(self, SELVES, s.line, '편지 · 마음'),
          last: f['마지막 문장'][0],
        },
        s.line,
        TONES,
      )
    }
  }

  const memoryRecord = Object.fromEntries(
    [...memories].map(([category, sides]) => [category, complete(sides, ['a', 'b'], memorySection.line, `\`${category}\` 회상`)]),
  ) as Record<string, Record<Side, Scene>>
  const ask = child(section, '마지막 질문')
  const join = fields(child(section, '편지 이음'), ['회상 앞', '끝인사', '서명', '공유 문구'])

  return {
    intro: lines(child(section, '도입')),
    guesses: choicesOf(child(section, '첫 질문'), GUESSES),
    reveal: { name: reveal['이름'][0], text: reveal['문구'], button: reveal['버튼'][0] },
    greetings: complete(greetings, GUESSES, section.line, '첫 인사'),
    memoryQuestions,
    memories: memoryRecord,
    combos: comboRows.map((row) => {
      const found = combos.get(row.id) ?? fail(row.line, `"### COMBO ${row.id} · 이름" 장면이 없어요`)
      return { ...found, when: row.when }
    }),
    memoryClosing: lines(child(section, '회상 마무리')),
    endings: complete(endings, TONES, section.line, '엔딩'),
    ask: { talk: lines(ask), choices: choicesOf(ask, SELVES) },
    answers: complete(answers, SELVES, section.line, '마지막 질문의 대답'),
    farewell: lines(child(section, '작별')),
    beforeLetter: lines(child(section, '편지 앞')),
    join: {
      memoryLead: join['회상 앞'][0],
      goodbye: join['끝인사'][0],
      signature: join['서명'][0],
      shareText: join['공유 문구'][0],
    },
  }
}

export function parseStory(md: string): Story {
  const outer = outline(md)
  // chapters sit under the document title
  const root = outer.children.find((s) => s.level === 1) ?? outer
  return {
    tiers: tiersOf(child(root, '2. 취향 등급')),
    matchLines: matchLinesOf(child(child(root, '3. 사용자 흐름'), '3-3. 취향 우주')),
    rankLines: rankLinesOf(child(child(root, '3. 사용자 흐름'), '3-4. 소수파 순위')),
    debate: debateOf(child(child(root, '3. 사용자 흐름'), '3-5. 취향 논쟁')),
    ...endingOf(child(root, '4. 엔딩 스토리'), questionOptions(child(root, '5. 카테고리와 문항'))),
  }
}
