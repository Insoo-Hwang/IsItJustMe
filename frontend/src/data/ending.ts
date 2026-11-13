import story from './story.ts'

export { SPEAKER_NAMES, type Face, type Guess, type Line, type Self, type Speaker } from '../../story/parse.ts'
export { afterLines, letterOf, matchingCombos, memoryKey, planEnding, talkLines, type EndingPlan, type Letter, type MemoryAnswer } from '../../story/ending.ts'

// The texts are written in STORY.md, chapter 4.
export const {
  intro: INTRO,
  guesses: GUESSES,
  reveal: REVEAL,
  memoryQuestions: MEMORY_QUESTIONS,
  ask: ASK,
  endings: ENDINGS,
  join: JOIN,
} = story

export { story as STORY }
