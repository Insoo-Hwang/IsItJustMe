import type { Choice } from '../data/categories.ts'
import type { Tone } from './rarity.ts'
import { box, fit, font, hexagon, INK, INK_2, SURFACE, text, TONES, wrap, type Ctx } from './tasteCard.ts'

// The picture on a KakaoTalk share message.
export type ShareImageData =
  // a category's "나만 그래?" link: the two options face to face, the sharer's side marked
  | { kind: 'debate'; name: string; prompt: string; a: string; b: string; pick: Choice }
  // the taste universe link: the sharer's hexagon as the sun of their universe, and the tier
  | {
      kind: 'summary'
      name: string
      tier: string
      tone: Tone
      headline: string
      minority: number
      picks: number
      // 0 ~ 1 per category, clockwise from the top
      axes: { label: string; value: number }[]
    }

// KakaoTalk shows the picture of a feed message twice as wide as it is tall.
export const SHARE_IMAGE_WIDTH = 1200
export const SHARE_IMAGE_HEIGHT = 600

// The two sides in the colors of index.css, strong enough to carry white text.
const SIDES: Record<Choice, string> = {
  a: 'oklch(0.63 0.19 20)',
  b: 'oklch(0.56 0.18 256)',
}

const W = SHARE_IMAGE_WIDTH
const H = SHARE_IMAGE_HEIGHT
const MID = W / 2

// KakaoTalk shows the picture small, so it is a poster: two flat halves, few big words.
function drawDebate(ctx: Ctx, data: Extract<ShareImageData, { kind: 'debate' }>) {
  // slanted split
  const lean = 46
  ctx.fillStyle = SIDES.a
  ctx.fillRect(0, 0, W, H)
  ctx.beginPath()
  ctx.moveTo(MID + lean, 0)
  ctx.lineTo(W, 0)
  ctx.lineTo(W, H)
  ctx.lineTo(MID - lean, H)
  ctx.closePath()
  ctx.fillStyle = SIDES.b
  ctx.fill()

  ctx.fillStyle = SURFACE
  font(ctx, 52, 800)
  const prompt = wrap(ctx, data.prompt, W - 160, 2)
  prompt.forEach((line, i) => text(ctx, line, MID, (prompt.length === 1 ? 128 : 100) + i * 64, 'center'))

  const middle = 370
  ;(['a', 'b'] as const).forEach((side) => {
    const center = side === 'a' ? 290 : W - 290
    font(ctx, 62, 850)
    ctx.fillStyle = SURFACE
    const label = wrap(ctx, data[side], 430, 2)
    const first = middle + 22 - (label.length - 1) * 38
    label.forEach((line, i) => text(ctx, line, center, first + i * 76, 'center'))

    if (side === data.pick) {
      font(ctx, 28, 750)
      const tag = `${data.name}의 선택`
      const tagWidth = ctx.measureText(tag).width + 48
      const tagTop = first - 62 - 78
      box(ctx, center - tagWidth / 2, tagTop, tagWidth, 54, 27, SURFACE)
      ctx.fillStyle = SIDES[side]
      text(ctx, tag, center, tagTop + 37, 'center')
    }
  })

  ctx.beginPath()
  ctx.arc(MID, middle, 64, 0, Math.PI * 2)
  ctx.fillStyle = SURFACE
  ctx.fill()
  font(ctx, 46, 900)
  ctx.fillStyle = INK
  text(ctx, 'VS', MID, middle + 17, 'center')
}

// The universe panel, with the numbers of TasteUniverse.tsx scaled up.
const SPACE = { x: 28, y: 28, size: H - 56 }
const SUN = 150
const MIN_ORBIT = 184
const MAX_ORBIT = 246
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const PLANET_COLORS = ['oklch(0.78 0.1 230)', 'oklch(0.84 0.1 85)', 'oklch(0.78 0.1 165)', 'oklch(0.76 0.11 300)', 'oklch(0.78 0.1 30)']
// The planets are decoration, the same on every picture: how far out each one sits (0 ~ 1).
const PLANETS = [0.2, 0.75, 0.45, 1, 0.1, 0.6]

function drawUniverse(ctx: Ctx, data: Extract<ShareImageData, { kind: 'summary' }>, deep: string) {
  const { x, y, size } = SPACE
  const cx = x + size / 2
  const cy = y + size / 2

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, size, size, 44)
  ctx.clip()
  const sky = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.7)
  sky.addColorStop(0, 'oklch(0.28 0.045 275)')
  sky.addColorStop(1, 'oklch(0.15 0.02 275)')
  ctx.fillStyle = sky
  ctx.fillRect(x, y, size, size)

  // fixed star field
  ctx.fillStyle = 'oklch(1 0 0 / 0.45)'
  for (let i = 0; i < 60; i++) {
    const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1
    ctx.beginPath()
    ctx.arc(x + r(1) * size, y + r(2) * size, 1 + r(3) * 2, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.strokeStyle = 'oklch(1 0 0 / 0.14)'
  ctx.lineWidth = 2
  for (const orbit of [MIN_ORBIT, (MIN_ORBIT + MAX_ORBIT) / 2, MAX_ORBIT]) {
    ctx.beginPath()
    ctx.arc(cx, cy, orbit, 0, Math.PI * 2)
    ctx.stroke()
  }

  PLANETS.forEach((far, i) => {
    const orbit = MIN_ORBIT + far * (MAX_ORBIT - MIN_ORBIT)
    const angle = -Math.PI / 2 + (i + 0.5) * GOLDEN_ANGLE
    ctx.beginPath()
    ctx.arc(cx + orbit * Math.cos(angle), cy + orbit * Math.sin(angle), 13 + (i % 3) * 4, 0, Math.PI * 2)
    ctx.fillStyle = PLANET_COLORS[i % PLANET_COLORS.length]
    ctx.fill()
  })
  ctx.restore()

  // the sharer is the sun: their hexagon alone on a white disc, without the category names
  ctx.beginPath()
  ctx.arc(cx, cy, SUN + 14, 0, Math.PI * 2)
  ctx.fillStyle = 'oklch(1 0 0 / 0.1)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, SUN, 0, Math.PI * 2)
  ctx.fillStyle = SURFACE
  ctx.fill()
  hexagon(ctx, cx, cy, 122, data.axes, deep, 0)
}

function drawSummary(ctx: Ctx, data: Extract<ShareImageData, { kind: 'summary' }>) {
  const tone = TONES[data.tone]
  // a white card on the tier's color, like the taste card
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, tone.light)
  bg.addColorStop(1, tone.soft)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  box(ctx, 28, 28, W - 56, H - 56, 44, SURFACE)
  drawUniverse(ctx, data, tone.deep)

  const left = SPACE.x + SPACE.size + 52
  const width = W - 76 - left
  font(ctx, 32, 600)
  ctx.fillStyle = INK_2
  text(ctx, fit(ctx, `${data.name}의 취향 우주`, width), left, 168)

  // long tier names shrink to stay on one line
  let size = 104
  font(ctx, size, 850)
  while (size > 56 && ctx.measureText(data.tier).width > width) {
    size -= 4
    font(ctx, size, 850)
  }
  ctx.fillStyle = tone.deep
  text(ctx, data.tier, left, 282)

  font(ctx, 32, 600)
  ctx.fillStyle = INK
  wrap(ctx, data.headline, width, 2).forEach((line, i) => text(ctx, line, left, 346 + i * 44))

  font(ctx, 26, 700)
  const chip = `소수 선택 ${data.minority}/${data.picks}`
  const chipWidth = ctx.measureText(chip).width + 44
  box(ctx, left, 446, chipWidth, 54, 27, tone.soft)
  ctx.fillStyle = tone.deep
  text(ctx, chip, left + 22, 482)
}

export function drawShareImage(canvas: HTMLCanvasElement, data: ShareImageData) {
  canvas.width = SHARE_IMAGE_WIDTH
  canvas.height = SHARE_IMAGE_HEIGHT
  const ctx = canvas.getContext('2d')!
  if (data.kind === 'debate') drawDebate(ctx, data)
  else drawSummary(ctx, data)
}
