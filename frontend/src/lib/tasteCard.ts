import type { Tone } from './rarity.ts'

export type TasteCardData = {
  tier: string
  tone: Tone
  headline: string
  topPercent: number | null
  rankLine: string | null
  minority: number
  picks: number
  averageMatch: number | null
  exact: number
  // 0 ~ 1 per category, clockwise from the top
  axes: { label: string; value: number }[]
  categories: { name: string; tier: string; tone: Tone }[]
  rarest: { prompt: string; choice: string; rate: number }
}

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1440

// The light tier colors from tier.module.css. The card is an image people pass around, so
// it keeps the light look even when the page is dark.
const TONES: Record<Tone, { soft: string; light: string; deep: string }> = {
  common: { soft: 'oklch(0.95 0.03 255)', light: 'oklch(0.86 0.07 255)', deep: 'oklch(0.5 0.15 260)' },
  firm: { soft: 'oklch(0.95 0.035 170)', light: 'oklch(0.85 0.07 170)', deep: 'oklch(0.48 0.1 170)' },
  unique: { soft: 'oklch(0.955 0.03 45)', light: 'oklch(0.86 0.08 45)', deep: 'oklch(0.55 0.16 38)' },
  rare: { soft: 'oklch(0.95 0.035 300)', light: 'oklch(0.85 0.08 300)', deep: 'oklch(0.5 0.17 300)' },
}
const INK = 'oklch(0.2 0.006 286)'
const INK_2 = 'oklch(0.44 0.008 286)'
const INK_3 = 'oklch(0.6 0.008 286)'
const SURFACE = 'oklch(1 0 0)'
const SURFACE_2 = 'oklch(0.965 0.003 286)'
const HAIRLINE = 'oklch(0.2 0.01 286 / 0.1)'
const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"

const LEFT = 112
const RIGHT = CARD_WIDTH - 112
const WIDTH = RIGHT - LEFT

type Ctx = CanvasRenderingContext2D

function font(ctx: Ctx, size: number, weight = 500) {
  ctx.font = `${weight} ${size}px ${FONT}`
}

function text(ctx: Ctx, value: string, x: number, y: number, align: CanvasTextAlign = 'left') {
  ctx.textAlign = align
  ctx.fillText(value, x, y)
}

// Cuts the text with "…" so it fits in maxWidth.
function fit(ctx: Ctx, value: string, maxWidth: number): string {
  if (ctx.measureText(value).width <= maxWidth) return value
  let end = value.length
  while (end > 0 && ctx.measureText(`${value.slice(0, end)}…`).width > maxWidth) end--
  return `${value.slice(0, end)}…`
}

// Breaks at spaces into at most `max` lines.
function wrap(ctx: Ctx, value: string, maxWidth: number, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of value.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  if (lines.length <= max) return lines
  return [...lines.slice(0, max - 1), fit(ctx, lines.slice(max - 1).join(' '), maxWidth)]
}

function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

function hexagon(ctx: Ctx, cx: number, cy: number, radius: number, data: TasteCardData, deep: string) {
  const count = data.axes.length
  const at = (i: number, r: number): [number, number] => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
  }
  const shape = (values: number[]) => {
    ctx.beginPath()
    values.forEach((v, i) => ctx.lineTo(...at(i, radius * v)))
    ctx.closePath()
  }
  ctx.strokeStyle = HAIRLINE
  ctx.lineWidth = 2
  for (const ring of [0.5, 1]) {
    shape(data.axes.map(() => ring))
    ctx.stroke()
  }
  shape(data.axes.map((a) => Math.max(0.04, a.value)))
  ctx.fillStyle = `color-mix(in oklch, ${deep} 28%, transparent)`
  ctx.fill()
  ctx.strokeStyle = deep
  ctx.lineWidth = 4
  ctx.stroke()

  font(ctx, 22, 600)
  ctx.fillStyle = INK_2
  ctx.textBaseline = 'middle'
  data.axes.forEach((a, i) => {
    const [x, y] = at(i, radius + 34)
    text(ctx, a.label, x, y, 'center')
  })
  ctx.textBaseline = 'alphabetic'
}

// Draws the shareable taste card: tier, rank, numbers, hexagon and the rarest pick.
export function drawTasteCard(canvas: HTMLCanvasElement, data: TasteCardData) {
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')!
  const tone = TONES[data.tone]

  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT)
  bg.addColorStop(0, tone.light)
  bg.addColorStop(1, tone.soft)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  box(ctx, 48, 48, CARD_WIDTH - 96, CARD_HEIGHT - 96, 56, SURFACE)

  // tier
  const mid = CARD_WIDTH / 2
  font(ctx, 32, 600)
  ctx.fillStyle = INK_2
  text(ctx, '나의 취향 등급', mid, 164, 'center')
  font(ctx, 128, 850)
  ctx.fillStyle = tone.deep
  text(ctx, data.tier, mid, 290, 'center')
  font(ctx, 34, 600)
  ctx.fillStyle = INK
  wrap(ctx, data.headline, WIDTH, 2).forEach((line, i) => text(ctx, line, mid, 356 + i * 46, 'center'))

  // rank band
  let y = 428
  box(ctx, LEFT, y, WIDTH, 200, 32, tone.soft)
  font(ctx, 28, 600)
  ctx.fillStyle = INK_2
  text(ctx, '내 희귀도는', LEFT + 40, y + 56)
  if (data.topPercent != null) {
    font(ctx, 72, 850)
    ctx.fillStyle = tone.deep
    text(ctx, `상위 ${data.topPercent}%`, LEFT + 40, y + 136)
    font(ctx, 28, 650)
    ctx.fillStyle = tone.deep
    text(ctx, fit(ctx, data.rankLine ?? '', WIDTH - 300), RIGHT - 40, y + 56, 'right')
    const trackY = y + 166
    const trackW = WIDTH - 80
    box(ctx, LEFT + 40, trackY, trackW, 10, 5, SURFACE)
    const dotX = LEFT + 40 + (trackW * Math.min(100, data.topPercent)) / 100
    box(ctx, LEFT + 40, trackY, Math.max(10, dotX - LEFT - 40), 10, 5, tone.deep)
    ctx.beginPath()
    ctx.arc(dotX, trackY + 5, 14, 0, Math.PI * 2)
    ctx.fillStyle = SURFACE
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = tone.deep
    ctx.stroke()
  } else {
    font(ctx, 72, 850)
    ctx.fillStyle = tone.deep
    text(ctx, '1호 완주자', LEFT + 40, y + 140)
  }

  // numbers
  y = 658
  const gap = 20
  const cellW = (WIDTH - gap * 2) / 3
  const cells = [
    { value: `${data.minority}`, unit: `/${data.picks}`, label: '소수 선택' },
    { value: data.averageMatch == null ? '-' : `${data.averageMatch}`, unit: data.averageMatch == null ? '' : '%', label: '평균 일치율' },
    { value: data.exact.toLocaleString('ko-KR'), unit: '명', label: '완전 일치' },
  ]
  cells.forEach((cell, i) => {
    const x = LEFT + i * (cellW + gap)
    box(ctx, x, y, cellW, 150, 28, SURFACE_2)
    font(ctx, 56, 800)
    const valueW = ctx.measureText(cell.value).width
    font(ctx, 28, 650)
    const unitW = ctx.measureText(cell.unit).width
    const start = x + (cellW - valueW - unitW - 4) / 2
    font(ctx, 56, 800)
    ctx.fillStyle = INK
    text(ctx, cell.value, start, y + 80)
    font(ctx, 28, 650)
    ctx.fillStyle = INK_3
    text(ctx, cell.unit, start + valueW + 4, y + 80)
    font(ctx, 24, 600)
    text(ctx, cell.label, x + cellW / 2, y + 122, 'center')
  })

  // hexagon and categories
  y = 848
  hexagon(ctx, LEFT + 150, y + 150, 100, data, tone.deep)
  const listX = LEFT + 360
  data.categories.forEach((c, i) => {
    const rowY = y + 40 + i * 46
    font(ctx, 28, 600)
    ctx.fillStyle = INK
    text(ctx, c.name, listX, rowY + 10)
    font(ctx, 24, 700)
    const chipW = ctx.measureText(c.tier).width + 28
    // each category in its own tier's color, like the list on the summary page
    const chip = TONES[c.tone]
    box(ctx, RIGHT - chipW, rowY - 20, chipW, 40, 12, chip.soft)
    ctx.fillStyle = chip.deep
    text(ctx, c.tier, RIGHT - chipW / 2, rowY + 8, 'center')
  })

  // rarest pick
  y = 1224
  ctx.fillStyle = HAIRLINE
  ctx.fillRect(LEFT, y - 60, WIDTH, 2)
  font(ctx, 26, 600)
  ctx.fillStyle = INK_2
  text(ctx, '가장 적은 사람이 고른 내 선택', LEFT, y)
  font(ctx, 34, 750)
  ctx.fillStyle = INK
  text(ctx, fit(ctx, `${data.rarest.prompt} → ${data.rarest.choice}`, WIDTH), LEFT, y + 52)
  font(ctx, 28, 650)
  ctx.fillStyle = tone.deep
  text(ctx, `단 ${data.rarest.rate}%만 나와 같은 선택!`, LEFT, y + 96)
}

export function cardBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('card image failed'))), 'image/png'),
  )
}
