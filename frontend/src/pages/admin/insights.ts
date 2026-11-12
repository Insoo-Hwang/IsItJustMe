import type { Dashboard } from './api.ts'

export const FUNNEL_LABELS: Record<string, string> = {
  visited: '방문',
  profiled: '프로필 입력',
  started: '테스트 1개 완료',
  halfway: '절반 이상 완료',
  finished: '전부 완료',
  shared: '공유 링크 생성',
}

export const EVENT_LABELS: Record<string, string> = {
  AD_VIEW: '광고 노출',
  AD_CLICK: '광고 클릭',
  AD_SKIP: '광고 건너뛰기',
  SHARE_UNIVERSE: '취향 우주 공유',
  SHARE_DEBATE: '나만 그래? 공유',
  INVITE_OPEN: '초대 링크 열람',
  DEBATE_OPEN: '나만 그래? 링크 열람',
  DEBATE_PICK: '나만 그래? 편 고르기',
  CARD_SAVE: '취향 카드 저장',
  ENDING_OPEN: '엔딩 진입',
}

export const fmt = (n: number) => n.toLocaleString('ko-KR')

// share as a percentage with one decimal; null when there is nothing to divide by
export function rate(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null
}

export const pct = (value: number | null) => (value == null ? '–' : `${value}%`)

export type Insight = { title: string; text: string }

// Sentences worth reading before the charts, each from numbers already on the page.
export function insightsOf(d: Dashboard): Insight[] {
  const out: Insight[] = []

  // the funnel step that loses the largest share of the guests who reached it
  let worst: { from: string; to: string; lost: number } | null = null
  for (let i = 1; i < d.funnel.length; i++) {
    const before = d.funnel[i - 1].count
    if (before === 0) continue
    const lost = 1 - d.funnel[i].count / before
    if (!worst || lost > worst.lost) worst = { from: d.funnel[i - 1].key, to: d.funnel[i].key, lost }
  }
  if (worst) {
    out.push({
      title: '가장 많이 이탈하는 구간',
      text: `'${FUNNEL_LABELS[worst.from]}'에서 '${FUNNEL_LABELS[worst.to]}'로 넘어가지 못한 비율이 ${Math.round(worst.lost * 100)}%로 가장 커요.`,
    })
  }

  const finishRate = rate(d.totals.finished, d.totals.started)
  if (finishRate != null) {
    out.push({
      title: '완주율',
      text: `테스트를 하나라도 끝낸 ${fmt(d.totals.started)}명 중 ${finishRate}%(${fmt(d.totals.finished)}명)가 전부 끝냈어요.`,
    })
  }

  const entry = [...d.categories].sort((a, b) => b.firstPicks - a.firstPicks)[0]
  if (entry && entry.firstPicks > 0) {
    out.push({
      title: '첫 테스트로 가장 많이 고른 카테고리',
      text: `${entry.name}. ${fmt(entry.firstPicks)}명이 여기서 시작했어요 (시작한 사람의 ${pct(rate(entry.firstPicks, d.totals.started))}).`,
    })
  }

  const answered = d.questions.filter((q) => q.total > 0)
  if (answered.length > 0) {
    const gap = (q: (typeof answered)[number]) => Math.abs(q.option0Count / q.total - 0.5)
    const close = answered.reduce((a, b) => (gap(b) < gap(a) ? b : a))
    const lopsided = answered.reduce((a, b) => (gap(b) > gap(a) ? b : a))
    const share = (q: (typeof answered)[number]) => Math.round((q.option0Count / q.total) * 100)
    out.push({
      title: '가장 팽팽한 문항',
      text: `"${close.prompt}" ${close.option0} ${share(close)}% : ${close.option1} ${100 - share(close)}%`,
    })
    out.push({
      title: '가장 쏠린 문항',
      text: `"${lopsided.prompt}" ${lopsided.option0} ${share(lopsided)}% : ${lopsided.option1} ${100 - share(lopsided)}%`,
    })
  }

  const views = d.period.AD_VIEW?.current ?? 0
  const clicks = d.period.AD_CLICK?.current ?? 0
  if (views > 0) {
    out.push({
      title: '광고 클릭률',
      text: `최근 ${d.days}일 노출 ${fmt(views)}회 중 ${fmt(clicks)}회 클릭, CTR ${pct(rate(clicks, views))}.`,
    })
  }

  if (d.totals.rooms > 0) {
    const perRoom = Math.round((d.totals.planets / d.totals.rooms) * 100) / 100
    out.push({
      title: '공유 한 번이 데려오는 친구',
      text: `공유 링크 ${fmt(d.totals.rooms)}개에 친구 ${fmt(d.totals.planets)}명이 등록했어요. 링크 하나당 ${perRoom}명이고, 친구가 한 명이라도 온 링크는 ${pct(rate(d.totals.roomsWithPlanets, d.totals.rooms))}예요.`,
    })
  }

  const peak = d.hours.indexOf(Math.max(...d.hours))
  if (d.hours[peak] > 0) {
    out.push({
      title: '가장 붐비는 시간',
      text: `${peak}시대에 테스트 완료가 가장 많아요 (최근 ${d.days}일 ${fmt(d.hours[peak])}건).`,
    })
  }
  return out
}
