// Whether the last syllable has a final consonant. Non-Hangul endings count as none.
function hasFinal(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code <= 11171 && code % 28 !== 0
}

// Picks 은/는 by whether the last syllable has a final consonant.
export function withTopic(word: string): string {
  return `${word}${hasFinal(word) ? '은' : '는'}`
}

// 와/과: "철수와", "민준과"
export function withAnd(word: string): string {
  return `${word}${hasFinal(word) ? '과' : '와'}`
}

// 랑/이랑: "철수랑", "민준이랑"
export function withRang(word: string): string {
  return `${word}${hasFinal(word) ? '이랑' : '랑'}`
}
