import bgCommon from '../assets/ending/bg-common.webp'
import bgFirm from '../assets/ending/bg-firm.webp'
import bgRare from '../assets/ending/bg-rare.webp'
import bgUnique from '../assets/ending/bg-unique.webp'
import nowSmile from '../assets/ending/now-smile.webp'
import now from '../assets/ending/now.webp'
import pastSad from '../assets/ending/past-sad.webp'
import pastSmile from '../assets/ending/past-smile.webp'
import pastSurprised from '../assets/ending/past-surprised.webp'
import past from '../assets/ending/past.webp'
import type { Face, Speaker, Tone } from '../../story/parse.ts'

// Dialogue background per ending.
export const BACKGROUNDS: Record<Tone, string> = { rare: bgRare, unique: bgUnique, firm: bgFirm, common: bgCommon }

// Full-body sprites; both face right as drawn.
const SPRITES: Record<Exclude<Speaker, 'system'>, Partial<Record<Face, string>>> = {
  past: { default: past, smile: pastSmile, surprised: pastSurprised, sad: pastSad },
  now: { default: now, smile: nowSmile },
}

export function spriteOf(speaker: Exclude<Speaker, 'system'>, face: Face): string {
  return SPRITES[speaker][face] ?? SPRITES[speaker].default!
}

// Loads every sprite and the ending's background ahead, so a face change never flickers.
export function preloadArt(tone: Tone) {
  for (const src of [BACKGROUNDS[tone], ...Object.values(SPRITES).flatMap((faces) => Object.values(faces))]) {
    new Image().src = src
  }
}
