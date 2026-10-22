// Picks 은/는 by whether the last syllable has a final consonant.
export function withTopic(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0
  return `${word}${hasFinal ? '은' : '는'}`
}
