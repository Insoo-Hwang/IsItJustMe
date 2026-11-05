// Reads the screen texts out of STORY.md (tiers, universe lines, the ending). No file
// access here, so the app can import the types too. Errors point at the line to fix.

export type Tone = 'rare' | 'unique' | 'firm' | 'common'

export type Speaker = 'system' | 'past' | 'now'

export type Guess = 'same' | 'different' | 'unsure'

export type Face = 'default' | 'smile' | 'surprised' | 'sad'

export type Line = { speaker: Speaker; face: Face; text: string }

export type Ending = {
  no: string
  // dialogue title
  scene: string
  talk: Line[]
  // letter title
  title: string
  letter: string[]
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
  greetings: Record<Guess, Line[]>
  endings: Record<Tone, Ending>
}

const TONES: Tone[] = ['rare', 'unique', 'firm', 'common']
const GUESSES: Guess[] = ['same', 'different', 'unsure']

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

function endingOf(section: Section): Omit<Story, 'tiers' | 'matchLines' | 'rankLines' | 'debate'> {
  const guessRows = table(child(section, '마지막 질문'))
  const guesses = new Map<string, string>()
  for (const row of guessRows) once(guesses, code(row.cells[0], row.line), row.cells[1], row.line, GUESSES)
  complete(guesses, GUESSES, section.line, '마지막 질문')

  const reveal = fields(child(section, '공개'), ['이름', '문구', '버튼'], ['문구'])

  const greetings = new Map<string, Line[]>()
  const endings = new Map<string, Ending>()
  for (const s of section.children) {
    const greeting = /^첫 인사 · `(\w+)`$/.exec(s.title)
    if (greeting) once(greetings, greeting[1], lines(s), s.line, GUESSES)
    const ending = /^ENDING (\d+) · `(\w+)`$/.exec(s.title)
    if (ending) {
      const titles = fields(s, ['대화 제목', '편지 제목'])
      once(
        endings,
        ending[2],
        {
          no: ending[1],
          scene: titles['대화 제목'][0],
          talk: lines(child(s, '대화')),
          title: titles['편지 제목'][0],
          letter: paragraphs(child(s, '편지')),
        },
        s.line,
        TONES,
      )
    }
  }

  return {
    intro: lines(child(section, '도입')),
    guesses: guessRows.map((row) => ({ id: code(row.cells[0], row.line) as Guess, label: row.cells[1] })),
    reveal: { name: reveal['이름'][0], text: reveal['문구'], button: reveal['버튼'][0] },
    greetings: complete(greetings, GUESSES, section.line, '첫 인사'),
    endings: complete(endings, TONES, section.line, '엔딩'),
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
    ...endingOf(child(root, '4. 엔딩 스토리')),
  }
}
