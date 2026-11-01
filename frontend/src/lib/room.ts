import { useQuery } from '@tanstack/react-query'
import { HttpError } from '../api/categories.ts'
import { fetchRoom, type RoomDto } from '../api/rooms.ts'
import { CATEGORIES, findCategory, fromAnswerBits, type Category } from '../data/categories.ts'
import { useTestState, type TestState } from '../store/testStore.ts'
import { rarityOf, type RarityResult } from './rarity.ts'

// Owner and planet names are stored, so the server keeps the same limit.
export const NAME_MAX_LENGTH = 10

// ?invite=<share token> stays on every page while an invited friend takes the tests.
export const INVITE_PARAM = 'invite'

// One page per link: the invite, the owner's universe and the viewer's comparison.
export const invitePath = (token: string) => `/invite/${token}`

// Where a friend continues the tests: the next category not finished yet.
export function nextTestPath(results: TestState['results']): string {
  const next = CATEGORIES.find((c) => !results[c.id])
  return next ? `/test/${next.id}` : '/main'
}

// A wrong link stays wrong (404), and a 400 / 409 will not change on a retry.
export const roomRetry = (count: number, err: unknown) =>
  !(err instanceof HttpError && [400, 404, 409].includes(err.status)) && count < 2

export function roomQuery(token: string) {
  return { queryKey: ['room', token], queryFn: () => fetchRoom(token), retry: roomRetry }
}

// The room this guest was invited to, for the home and result pages. Hidden when the
// guest turns out to be the owner.
export function useInviteRoom(): { token: string; room: RoomDto } | null {
  const { invite } = useTestState()
  const query = useQuery({ ...roomQuery(invite?.token ?? ''), enabled: invite != null })
  if (!invite || !query.data || query.data.viewer.role === 'OWNER') return null
  return { token: invite.token, room: query.data }
}

export function matchLine(match: number): string {
  if (match >= 80) return '거의 같은 행성 출신인데?'
  if (match >= 60) return '생각보다 취향이 비슷한 편!'
  if (match >= 40) return '반은 통하고 반은 갈리는 사이'
  return '취향 우주의 반대편에 살고 있네'
}

export type BitsRow = { category: Category; rarity: RarityResult }

// Rarity per category from answers sent as bits, using the current pick rates.
export function rowsOf(answers: { code: string; bits: number }[]): BitsRow[] {
  return answers.flatMap(({ code, bits }) => {
    const category = findCategory(code)
    return category ? [{ category, rarity: rarityOf(category.questions, fromAnswerBits(bits)) }] : []
  })
}
