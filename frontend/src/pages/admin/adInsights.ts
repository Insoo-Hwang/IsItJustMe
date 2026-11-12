import { findCategory } from '../../data/categories.ts'
import { ADS, findAd, PLACEMENT_LABELS, type Ad, type AdKind, type AdPlacement } from '../../lib/ads.ts'
import { ageGroupLabel, genderLabel, type AgeGroup, type Gender } from '../../lib/profile.ts'
import type { AdReport, AdStat } from './api.ts'
import { fmt, pct, rate, type Insight } from './insights.ts'

// Below this many views one click moves the rate by several points, so such rows are
// shown but never ranked. At 100 views a 5% rate is still about ±4%p.
export const MIN_VIEWS = 100
const FEW_VIEWS = 300

type Counts = { views: number; clicks: number }

export const adName = (id: string) => findAd(id)?.name ?? id
export const categoryName = (code: string) => findCategory(code)?.name ?? code
export const placementName = (key: string) => PLACEMENT_LABELS[key as AdPlacement] ?? key
export const audienceName = (a: { gender: string; ageGroup: string }) =>
  `${ageGroupLabel(a.ageGroup as AgeGroup)} ${genderLabel(a.gender as Gender)}`

export const ctr = (c: Counts) => rate(c.clicks, c.views)

// Half the width of the 95% range around a rate, in points: how far it may be off by
// chance. Wilson's interval, which stays honest at 0% and with few views.
export function margin(c: Counts): number | null {
  if (c.views === 0) return null
  const z = 1.96
  const n = c.views
  const p = c.clicks / n
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n)
  return Math.round(half * 1000) / 10
}

// Only the ad in the middle of a test has a skip button, so only its views are the base.
export const skipRate = (s: { skips: number; skippableViews: number }) => rate(s.skips, s.skippableViews)

export const KIND_NAMES: Record<AdKind, string> = { case: '폰케이스', pouch: '파우치', wallet: '카드지갑' }

// Every ad's numbers added up by the kind of product.
export function byKind(r: AdReport): { kind: AdKind; ads: Ad[]; views: number; clicks: number; reach: number }[] {
  return (Object.keys(KIND_NAMES) as AdKind[]).map((kind) => {
    const ads = ADS.filter((a) => a.kind === kind)
    const stats = ads.map((a) => r.ads.find((s) => s.ad === a.id))
    return {
      kind,
      ads,
      views: stats.reduce((n, s) => n + (s?.views ?? 0), 0),
      clicks: stats.reduce((n, s) => n + (s?.clicks ?? 0), 0),
      // the same person may have seen two ads of a kind, so this is an upper bound
      reach: stats.reduce((n, s) => n + (s?.reach ?? 0), 0),
    }
  })
}

// how many times the average rate a row's rate is, one decimal
export function lift(c: Counts, average: Counts): number | null {
  if (c.views === 0 || average.views === 0 || average.clicks === 0) return null
  return Math.round((c.clicks / c.views / (average.clicks / average.views)) * 10) / 10
}

const EMPTY: AdStat = {
  ad: null,
  views: 0,
  reach: 0,
  clicks: 0,
  clickers: 0,
  skips: 0,
  skippableViews: 0,
  previousViews: 0,
  previousClicks: 0,
}

// The numbers of what is selected: one ad, or every ad together.
export function selected(r: AdReport): AdStat {
  return r.ad == null ? r.total : (r.ads.find((a) => a.ad === r.ad) ?? { ...EMPTY, ad: r.ad })
}

// Every ad in the site's list with its numbers, plus ads that only the records still know.
export function adRows(r: AdReport): AdStat[] {
  const known = ADS.map((ad) => r.ads.find((a) => a.ad === ad.id) ?? { ...EMPTY, ad: ad.id })
  const retired = r.ads.filter((a) => a.ad != null && !findAd(a.ad))
  return [...known, ...retired]
}

// the row with the highest rate among rows with enough views to rank
function top<T extends Counts>(rows: T[]): T | null {
  const ranked = rows.filter((row) => row.views >= MIN_VIEWS && row.clicks > 0)
  return ranked.length === 0 ? null : ranked.reduce((a, b) => (b.clicks / b.views > a.clicks / a.views ? b : a))
}

// Sentences an advertiser can be handed as they are.
export function adInsightsOf(r: AdReport): Insight[] {
  const out: Insight[] = []
  const s = selected(r)
  if (s.views === 0) return out

  out.push({
    title: '요약',
    text: `최근 ${r.days}일 동안 ${fmt(s.reach)}명에게 ${fmt(s.views)}번 보였고, ${fmt(s.clickers)}명이 ${fmt(s.clicks)}번 눌렀어요. 클릭률(CTR) ${pct(ctr(s))}.`,
  })

  if (s.previousViews > 0) {
    const now = ctr(s) ?? 0
    const before = ctr({ views: s.previousViews, clicks: s.previousClicks }) ?? 0
    const word = now > before ? '올랐어요' : now < before ? '내렸어요' : '같아요'
    out.push({
      title: '이전 기간 대비',
      text: `노출 ${fmt(s.previousViews)} → ${fmt(s.views)}번, 클릭률 ${pct(before)} → ${pct(now)}로 ${word}.`,
    })
  }

  if (r.ad == null) {
    const ranked = adRows(r).filter((a) => a.views >= MIN_VIEWS && a.clicks > 0)
    const best = top(ranked)
    if (best && ranked.length >= 2) {
      out.push({
        title: '가장 잘 눌린 광고',
        text: `${adName(best.ad ?? '')}. 클릭률 ${pct(ctr(best))}로 전체 평균(${pct(ctr(r.total))})의 ${lift(best, r.total)}배예요.`,
      })
    }
  }

  const audience = top(r.audiences)
  if (audience) {
    out.push({
      title: '가장 반응이 좋은 사람들',
      text: `${audienceName(audience)}. 클릭률 ${pct(ctr(audience))}로 평균의 ${lift(audience, s)}배예요 (노출 ${fmt(audience.views)}번).`,
    })
  }

  const category = top(r.categories)
  if (category) {
    out.push({
      title: '가장 잘 눌린 순간',
      text: `${categoryName(category.key)} 테스트를 하던 중에 본 사람들이 가장 잘 눌렀어요 (클릭률 ${pct(ctr(category))}).`,
    })
  }

  // the hour people respond to best, not the hour with the most visitors
  const hour = top(r.hours)
  if (hour) {
    out.push({
      title: '반응이 가장 좋은 시간',
      text: `${hour.key}시대 클릭률이 ${pct(ctr(hour))}로 가장 높아요 (평균의 ${lift(hour, s)}배, 한국 시간).`,
    })
  }

  if (r.ad == null) {
    const kinds = byKind(r).filter((k) => k.views >= MIN_VIEWS)
    if (kinds.length >= 2) {
      const best = kinds.reduce((a, b) => (b.clicks / b.views > a.clicks / a.views ? b : a))
      out.push({
        title: '잘 눌리는 상품 종류',
        text: `${KIND_NAMES[best.kind]} 광고의 클릭률이 ${pct(ctr(best))}로 가장 높아요.`,
      })
    }
  }

  const skipped = skipRate(s)
  if (skipped != null) {
    out.push({
      title: '건너뛰기',
      text: `테스트 중간 광고 ${fmt(s.skippableViews)}번 중 ${pct(skipped)}에서 건너뛰기를 눌렀어요.`,
    })
  }

  const kept = rate(r.retention.finished, r.retention.viewed)
  if (kept != null) {
    out.push({
      title: '광고 뒤에도 테스트를 끝냈나',
      text: `테스트 중간에 광고를 본 ${fmt(r.retention.viewed)}건 중 ${pct(kept)}가 그 테스트를 끝까지 마쳤어요.`,
    })
  }

  if (s.views < FEW_VIEWS) {
    out.push({
      title: '읽을 때 주의',
      text: `아직 노출이 ${FEW_VIEWS}번 미만이라 비율이 크게 흔들려요. 순위는 노출 ${MIN_VIEWS}번 이상인 것만 매겨요.`,
    })
  }
  return out
}

const cell = (value: string | number) => {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

// The report as a spreadsheet-friendly file for the advertiser. The BOM makes Excel read
// the Korean text as UTF-8.
export function adReportCsv(r: AdReport): string {
  const s = selected(r)
  const lines: (string | number)[][] = [
    ['나만 그래? 광고 리포트'],
    ['기간', `최근 ${r.days}일`, '기준 시각', new Date(r.generatedAt).toLocaleString('ko-KR')],
    ['광고', r.ad == null ? '전체' : adName(r.ad)],
    [],
    ['요약', '노출', '도달(명)', '클릭', '클릭한 사람', 'CTR(%)', 'CTR 오차(±%p)', '건너뛴 비율(%)', '이전 기간 노출', '이전 기간 클릭'],
    ['', s.views, s.reach, s.clicks, s.clickers, ctr(s) ?? '', margin(s) ?? '', skipRate(s) ?? '', s.previousViews, s.previousClicks],
  ]
  if (r.ad == null) {
    lines.push([], ['광고별', '노출', '도달(명)', '클릭', 'CTR(%)', 'CTR 오차(±%p)', '건너뛴 비율(%)'])
    for (const a of adRows(r)) {
      lines.push([adName(a.ad ?? ''), a.views, a.reach, a.clicks, ctr(a) ?? '', margin(a) ?? '', skipRate(a) ?? ''])
    }
    lines.push([], ['상품 종류', '노출', '클릭', 'CTR(%)'])
    for (const k of byKind(r)) lines.push([KIND_NAMES[k.kind], k.views, k.clicks, ctr(k) ?? ''])
    lines.push([], ['광고', '위치', '노출', '클릭', 'CTR(%)'])
    for (const c of r.matrix) lines.push([adName(c.ad), placementName(c.placement), c.views, c.clicks, ctr(c) ?? ''])
  }
  lines.push([], ['날짜', '노출', '클릭', '건너뛰기'])
  for (const d of r.daily) lines.push([d.date, d.views, d.clicks, d.skips])
  lines.push([], ['나이대 · 성별', '노출', '노출 비중(%)', '클릭', 'CTR(%)'])
  const profiled = r.audiences.reduce((n, a) => n + a.views, 0)
  for (const a of r.audiences) lines.push([audienceName(a), a.views, rate(a.views, profiled) ?? '', a.clicks, ctr(a) ?? ''])
  lines.push([], ['테스트', '노출', '클릭', 'CTR(%)'])
  for (const c of r.categories) lines.push([categoryName(c.key), c.views, c.clicks, ctr(c) ?? ''])
  lines.push([], ['시간대', '노출', '클릭', 'CTR(%)'])
  for (const h of r.hours) lines.push([`${h.key}시`, h.views, h.clicks, ctr(h) ?? ''])
  lines.push([], ['노출 위치', '노출', '클릭', 'CTR(%)'])
  for (const p of r.placements) lines.push([placementName(p.key), p.views, p.clicks, ctr(p) ?? ''])
  lines.push([], ['노출은 광고 절반 이상이 1초 넘게 화면에 보였을 때, 같은 사람 · 광고 · 위치 · 테스트는 30분에 한 번만 셉니다.'])
  return '﻿' + lines.map((row) => row.map(cell).join(',')).join('\r\n')
}
