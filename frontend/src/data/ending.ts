import story from './story.ts'

export { SPEAKER_NAMES, type Ending, type Face, type Guess, type Line, type Speaker } from '../../story/parse.ts'

// The texts are written in STORY.md, chapter 4.
export const { intro: INTRO, guesses: GUESSES, reveal: REVEAL, greetings: GREETINGS, endings: ENDINGS } = story
