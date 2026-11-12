import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { HttpError } from '../../api/categories.ts'
import { ADS, adTitle, findAd } from '../../lib/ads.ts'
import { AGE_GROUPS, GENDERS } from '../../lib/profile.ts'
import {
  adInsightsOf,
  adName,
  adReportCsv,
  adRows,
  audienceName,
  categoryName,
  byKind,
  ctr,
  KIND_NAMES,
  lift,
  margin,
  MIN_VIEWS,
  placementName,
  selected,
  skipRate,
} from './adInsights.ts'
import { fetchAdReport, type AdReport } from './api.ts'
import { Bars, Card, Columns, DataTable, InsightList, Legend, StatTile, Trend } from './charts.tsx'
import { fmt, pct, rate } from './insights.ts'
import { SERIES } from './palette.ts'
import styles from './admin.module.css'

// the short product name, or the id of an ad no longer on the list
const adTitleOf = (id: string) => {
  const ad = findAd(id)
  return ad ? adTitle(ad) : id
}

const dayLabel = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`

function download(r: AdReport) {
  const blob = new Blob([adReportCsv(r)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ad-report-${r.ad ?? 'all'}-${r.days}d.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function AdTable({ r, onPick }: { r: AdReport; onPick: (id: string) => void }) {
  const rows = adRows(r).sort((a, b) => b.views - a.views)
  return (
    <div className={styles.tableScroll}>
      <table className={`${styles.table} ${styles.big}`}>
        <thead>
          <tr>
            <th>광고</th>
            <th>노출</th>
            <th>도달</th>
            <th>클릭</th>
            <th>CTR</th>
            <th>평균 대비</th>
            <th>건너뛴 비율</th>
            <th>이전 기간 노출</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const id = a.ad ?? ''
            const ad = findAd(id)
            const x = lift(a, r.total)
            return (
              <tr key={id}>
                <td>
                  <button type="button" className={styles.adCell} onClick={() => onPick(id)}>
                    {ad ? <img src={ad.image} alt="" className={styles.thumb} /> : <span className={styles.thumb} />}
                    <span>{adName(id)}</span>
                  </button>
                </td>
                <td>{fmt(a.views)}</td>
                <td>{fmt(a.reach)}명</td>
                <td>{fmt(a.clicks)}</td>
                <td>
                  {pct(ctr(a))}
                  {a.views > 0 && <span className={styles.margin}>±{margin(a)}</span>}
                  {a.views > 0 && a.views < MIN_VIEWS && <span className={styles.flag}>표본 적음</span>}
                </td>
                <td>{x == null || a.views < MIN_VIEWS ? '–' : `${x}배`}</td>
                <td>{pct(skipRate(a))}</td>
                <td>{fmt(a.previousViews)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Body({ r, onPick }: { r: AdReport; onPick: (id: string) => void }) {
  const days = r.days
  const s = selected(r)
  const labels = r.daily.map((d) => dayLabel(d.date))
  const genders = GENDERS.map((g, i) => ({ name: g.label, color: SERIES[i] }))
  const audienceCtr = AGE_GROUPS.map((age) => ({
    label: age.label,
    values: GENDERS.map((g) => {
      const row = r.audiences.find((a) => a.ageGroup === age.value && a.gender === g.value)
      return row ? (ctr(row) ?? 0) : 0
    }),
  }))
  const audiences = [...r.audiences].sort((a, b) => b.views - a.views)
  const profiledViews = audiences.reduce((n, a) => n + a.views, 0)
  const kinds = byKind(r)
  const placementsShown = [...new Set(r.matrix.map((c) => c.placement))]

  return (
    <>
      <h2 className={styles.sectionTitle}>한눈에 보기</h2>
      <section className={styles.card} aria-label="한눈에 보기">
        <InsightList items={adInsightsOf(r)} />
      </section>

      <h2 className={styles.sectionTitle}>
        최근 {days}일 <small>바로 앞 {days}일과 비교</small>
      </h2>
      <div className={styles.tiles}>
        <StatTile
          label="노출"
          value={`${fmt(s.views)}번`}
          change={{ current: s.views, previous: s.previousViews }}
          days={days}
        />
        <StatTile label="도달" value={`${fmt(s.reach)}명`} note="한 번 이상 본 사람" />
        <StatTile
          label="1인당 노출"
          value={s.reach > 0 ? `${Math.round((s.views / s.reach) * 10) / 10}번` : '–'}
          note="같은 사람에게 보인 평균 횟수"
        />
        <StatTile
          label="클릭"
          value={`${fmt(s.clicks)}번`}
          change={{ current: s.clicks, previous: s.previousClicks }}
          days={days}
        />
        <StatTile label="클릭한 사람" value={`${fmt(s.clickers)}명`} note={`도달의 ${pct(rate(s.clickers, s.reach))}`} />
        <StatTile
          label="클릭률 (CTR)"
          value={pct(ctr(s))}
          note={`이전 ${days}일 ${pct(rate(s.previousClicks, s.previousViews))}${s.views > 0 ? ` · 오차 ±${margin(s)}%p` : ''}`}
        />
        <StatTile
          label="건너뛴 비율"
          value={pct(skipRate(s))}
          note={`테스트 중간 광고 ${fmt(s.skippableViews)}번 중 ${fmt(s.skips)}번`}
        />
        <StatTile
          label="광고 뒤 테스트 완료"
          value={pct(rate(r.retention.finished, r.retention.viewed))}
          note="테스트 중간 광고를 보고도 그 테스트를 끝낸 비율"
        />
      </div>

      {r.ad == null && (
        <>
          <h2 className={styles.sectionTitle}>
            광고별 성과 <small>이름을 누르면 그 광고만 봐요</small>
          </h2>
          <div className={styles.cards}>
            <Card
              title="광고별 노출과 클릭"
              sub={`CTR 옆 ±는 우연으로 흔들릴 수 있는 폭(95%)이에요. 노출 ${MIN_VIEWS}번 미만은 평균과 비교하지 않아요.`}
            >
              <AdTable r={r} onPick={onPick} />
            </Card>
            <Card title="상품 종류별" sub="같은 종류 광고를 모두 더한 값">
              <Bars
                rows={kinds.map((k) => ({
                  label: KIND_NAMES[k.kind],
                  value: ctr(k) ?? 0,
                  note: `광고 ${k.ads.length}개 · 노출 ${fmt(k.views)} · 클릭 ${fmt(k.clicks)}`,
                }))}
                unit="%"
              />
            </Card>
            <Card title="광고 × 위치" sub="CTR (노출 수). 어떤 광고가 어느 자리에서 잘 되는지">
              {r.matrix.length === 0 ? (
                <p className={styles.empty}>아직 기록이 없어요.</p>
              ) : (
                <div className={styles.tableScroll}>
                  <table className={`${styles.table} ${styles.big}`}>
                    <thead>
                      <tr>
                        <th>광고</th>
                        {placementsShown.map((p) => (
                          <th key={p}>{placementName(p)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...new Set(r.matrix.map((c) => c.ad))].map((adId) => (
                        <tr key={adId}>
                          <td>{findAd(adId) ? adTitleOf(adId) : adId}</td>
                          {placementsShown.map((p) => {
                            const cell = r.matrix.find((c) => c.ad === adId && c.placement === p)
                            return <td key={p}>{cell ? `${pct(ctr(cell))} (${fmt(cell.views)})` : '–'}</td>
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      <h2 className={styles.sectionTitle}>추이</h2>
      <div className={styles.cards}>
        <Card
          title="일별 노출과 클릭"
          size="half"
          aside={
            <Legend
              items={[
                { name: '노출', color: SERIES[0], line: true },
                { name: '클릭', color: SERIES[1], line: true },
              ]}
            />
          }
        >
          <Trend
            series={[
              { name: '노출', color: SERIES[0], values: r.daily.map((d) => d.views) },
              { name: '클릭', color: SERIES[1], values: r.daily.map((d) => d.clicks) },
            ]}
            labels={labels}
          />
          <DataTable
            head={['날짜', '노출', '클릭', '건너뛰기', 'CTR']}
            rows={r.daily.map((d) => [d.date, d.views, d.clicks, d.skips, pct(ctr(d))])}
          />
        </Card>
        <Card title="시간대별 클릭률" sub="CTR (%), 한국 시간. 방문자가 많은 시간이 아니라 잘 반응하는 시간" size="half">
          <Columns
            groups={r.hours.map((h) => ({ label: `${h.key}시`, values: [ctr(h) ?? 0] }))}
            series={[{ name: '클릭률', color: SERIES[0] }]}
            labelEvery={3}
            unit="%"
          />
          <DataTable
            head={['시간', '노출', '클릭', 'CTR']}
            rows={r.hours.map((h) => [`${h.key}시`, h.views, h.clicks, pct(ctr(h))])}
          />
        </Card>
      </div>

      <h2 className={styles.sectionTitle}>
        누가 눌렀나 <small>프로필을 입력한 방문자</small>
      </h2>
      <div className={styles.cards}>
        <Card title="나이대 · 성별 클릭률" sub="CTR (%)" size="half" aside={<Legend items={genders} />}>
          <Columns groups={audienceCtr} series={genders} unit="%" />
        </Card>
        <Card
          title="그룹별 성과"
          sub={`노출 비중: 광고를 본 사람의 구성. 평균 대비: 전체 클릭률의 몇 배인지 (노출 ${MIN_VIEWS}번 이상만)`}
          size="half"
        >
          {audiences.length === 0 ? (
            <p className={styles.empty}>아직 기록이 없어요.</p>
          ) : (
            <div className={styles.tableScroll}>
              <table className={`${styles.table} ${styles.big}`}>
                <thead>
                  <tr>
                    <th>그룹</th>
                    <th>노출</th>
                    <th>노출 비중</th>
                    <th>클릭</th>
                    <th>CTR</th>
                    <th>평균 대비</th>
                  </tr>
                </thead>
                <tbody>
                  {audiences.map((a) => {
                    const x = lift(a, s)
                    return (
                      <tr key={`${a.ageGroup}-${a.gender}`}>
                        <td>{audienceName(a)}</td>
                        <td>{fmt(a.views)}</td>
                        <td>{pct(rate(a.views, profiledViews))}</td>
                        <td>{fmt(a.clicks)}</td>
                        <td>{pct(ctr(a))}</td>
                        <td>{x == null || a.views < MIN_VIEWS ? '–' : `${x}배`}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <h2 className={styles.sectionTitle}>어디서 봤나</h2>
      <div className={styles.cards}>
        <Card title="테스트별 클릭률" sub="광고를 본 순간 하고 있던 테스트" size="half">
          {r.categories.length === 0 ? (
            <p className={styles.empty}>아직 기록이 없어요.</p>
          ) : (
            <Bars
              rows={[...r.categories]
                .sort((a, b) => (ctr(b) ?? 0) - (ctr(a) ?? 0))
                .map((c) => ({
                  label: categoryName(c.key),
                  value: ctr(c) ?? 0,
                  note: `노출 ${fmt(c.views)} · 클릭 ${fmt(c.clicks)}`,
                }))}
              unit="%"
            />
          )}
        </Card>
        <Card title="노출 위치별" sub="광고가 들어간 자리" size="half">
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.big}`}>
              <thead>
                <tr>
                  <th>위치</th>
                  <th>노출</th>
                  <th>클릭</th>
                  <th>CTR</th>
                  <th>건너뛴 비율</th>
                </tr>
              </thead>
              <tbody>
                {r.placements.map((p) => (
                  <tr key={p.key}>
                    <td>{placementName(p.key)}</td>
                    <td>{fmt(p.views)}</td>
                    <td>{fmt(p.clicks)}</td>
                    <td>{pct(ctr(p))}</td>
                    <td>{p.key === 'QUIZ_BREAK' ? pct(rate(p.skips, p.views)) : '건너뛰기 없음'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}

// Per-ad numbers for the operator and, through the CSV, for the advertiser.
function AdsReport({ token, days, onUnauthorized }: { token: string; days: number; onUnauthorized: () => void }) {
  // the picked ad is in the address (?ad=), so back returns to the previous one
  const [params, setParams] = useSearchParams()
  const ad = params.get('ad')
  const query = useQuery({
    queryKey: ['admin', 'ads', token, days, ad],
    queryFn: async () => {
      try {
        return await fetchAdReport(token, days, ad)
      } catch (err) {
        if (err instanceof HttpError && err.status === 401) onUnauthorized()
        throw err
      }
    },
    placeholderData: keepPreviousData,
    retry: (count, err) => !(err instanceof HttpError && err.status === 401) && count < 2,
  })
  const r = query.data
  const pick = (id: string | null) => {
    if (id === ad) return
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (id) next.set('ad', id)
      else next.delete('ad')
      return next
    })
    window.scrollTo({ top: 0 })
  }
  const current = ad ? findAd(ad) : undefined

  return (
    <>
      <div className={styles.adFilters}>
        <div className={styles.tabs} role="group" aria-label="광고">
          <button type="button" aria-pressed={ad == null} onClick={() => pick(null)}>
            전체
          </button>
          {ADS.map((a) => (
            <button key={a.id} type="button" aria-pressed={ad === a.id} onClick={() => pick(a.id)} title={a.name}>
              {adTitle(a)}
            </button>
          ))}
        </div>
        <button type="button" className={styles.action} disabled={!r} onClick={() => r && download(r)}>
          CSV 내려받기
        </button>
      </div>

      {current && (
        <div className={styles.adHead}>
          <img src={current.image} alt="" className={styles.adHeadImage} />
          <div>
            <div className={styles.adHeadName}>{current.name}</div>
            <div className={styles.adHeadMeta}>
              {current.advertiser} · {current.id}
            </div>
            <a href={current.link} target="_blank" rel="noopener noreferrer" className={styles.adHeadLink}>
              상품 페이지 열기
            </a>
          </div>
        </div>
      )}

      {r ? (
        <div className={`${styles.body} ${query.isFetching ? styles.stale : ''}`}>
          <Body r={r} onPick={pick} />
        </div>
      ) : (
        <div className={styles.status} role={query.isError ? 'alert' : 'status'}>
          {query.isError ? '광고 리포트를 불러오지 못했어요.' : '불러오는 중…'}
        </div>
      )}
    </>
  )
}

export default AdsReport
