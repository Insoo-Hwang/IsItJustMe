import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { HttpError } from '../../api/categories.ts'
import { AGE_GROUPS, GENDERS } from '../../lib/profile.ts'
import { fetchDashboard, PERIODS, type Dashboard } from './api.ts'
import { Bars, Columns, DataTable, InsightList, Legend, SplitBar, StatTile, Trend } from './charts.tsx'
import { EVENT_LABELS, fmt, FUNNEL_LABELS, insightsOf, pct, rate } from './insights.ts'
import { SERIES } from './palette.ts'
import styles from './admin.module.css'

const TOKEN_KEY = 'admin-token'

function readToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function storeToken(token: string) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage blocked: the token lives only in memory for this visit
  }
}

// "2026-11-10" -> "11/10"
const dayLabel = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`

function Login({ failed, onSubmit }: { failed: boolean; onSubmit: (token: string) => void }) {
  const [value, setValue] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (value.trim()) onSubmit(value.trim())
  }
  return (
    <div className={styles.login}>
      <form className={styles.loginCard} onSubmit={submit}>
        <h1>나만 그래? 어드민</h1>
        <p>서버에 설정한 어드민 토큰(ADMIN_TOKEN)을 입력해 주세요.</p>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="어드민 토큰"
          aria-label="어드민 토큰"
          autoFocus
        />
        {failed && (
          <div className={styles.error} role="alert">
            토큰이 맞지 않아요.
          </div>
        )}
        <button type="submit" disabled={!value.trim()}>
          들어가기
        </button>
      </form>
    </div>
  )
}

function Card({ title, sub, size, aside, children }: {
  title: string
  sub?: string
  size?: 'half' | 'third'
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={`${styles.card} ${size ? styles[size] : ''}`} aria-label={title}>
      <div className={styles.cardHead}>
        <div>
          <h3 className={styles.cardTitle}>{title}</h3>
          {sub && <p className={styles.cardSub}>{sub}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

type Sort = 'order' | 'close' | 'lopsided'

function Questions({ d }: { d: Dashboard }) {
  const [category, setCategory] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('close')
  const names = Object.fromEntries(d.categories.map((c) => [c.code, c.name]))
  const gap = (q: Dashboard['questions'][number]) => (q.total > 0 ? Math.abs(q.option0Count / q.total - 0.5) : 1)
  const rows = d.questions.filter((q) => category == null || q.category === category)
  if (sort === 'close') rows.sort((a, b) => gap(a) - gap(b))
  // unanswered questions go last either way
  if (sort === 'lopsided') rows.sort((a, b) => (b.total > 0 ? gap(b) : -1) - (a.total > 0 ? gap(a) : -1))

  return (
    <Card
      title="문항별 선택 비율"
      sub="A를 고른 비율과 B를 고른 비율. 전체 기간, 응답한 사람 기준."
      aside={<Legend items={[{ name: 'A', color: 'var(--side-first)' }, { name: 'B', color: 'var(--side-second)' }]} />}
    >
      <div className={styles.tabs} style={{ marginBottom: 8 }}>
        <button type="button" aria-pressed={category == null} onClick={() => setCategory(null)}>
          전체
        </button>
        {d.categories.map((c) => (
          <button key={c.code} type="button" aria-pressed={category === c.code} onClick={() => setCategory(c.code)}>
            {c.name}
          </button>
        ))}
      </div>
      <div className={styles.tabs}>
        {(
          [
            ['close', '팽팽한 순'],
            ['lopsided', '쏠린 순'],
            ['order', '문항 순'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={sort === key} onClick={() => setSort(key)}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.tableScroll}>
        <table className={`${styles.table} ${styles.big}`}>
          <thead>
            <tr>
              <th>카테고리</th>
              <th className={styles.left}>질문</th>
              <th>A</th>
              <th className={styles.left}>비율</th>
              <th className={styles.left}>B</th>
              <th>A %</th>
              <th>B %</th>
              <th>응답 수</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => {
              const a = rate(q.option0Count, q.total)
              return (
                <tr key={`${q.category}-${q.number}`}>
                  <td>
                    {names[q.category]} {q.number}
                  </td>
                  <td className={`${styles.wrap} ${styles.left}`}>{q.prompt}</td>
                  <td>{q.option0}</td>
                  <td className={styles.left}>
                    <SplitBar
                      first={q.option0Count}
                      total={q.total}
                      label={`${q.option0} ${fmt(q.option0Count)}명, ${q.option1} ${fmt(q.total - q.option0Count)}명`}
                    />
                  </td>
                  <td className={styles.left}>{q.option1}</td>
                  <td>{pct(a)}</td>
                  <td>{pct(a == null ? null : Math.round((100 - a) * 10) / 10)}</td>
                  <td>{fmt(q.total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Body({ d }: { d: Dashboard }) {
  const days = d.days
  const labels = d.daily.map((day) => dayLabel(day.date))
  const event = (type: string) => d.daily.map((day) => day.events[type] ?? 0)
  const change = (key: string) => d.period[key] ?? { current: 0, previous: 0 }
  const views = change('AD_VIEW')
  const clicks = change('AD_CLICK')

  const trends = [
    { title: '새 방문자', name: '새 방문자', values: d.daily.map((day) => day.guests) },
    { title: '테스트 완료', name: '완료한 테스트', values: d.daily.map((day) => day.answers) },
    { title: '전부 완료한 사람', name: '전부 완료', values: d.daily.map((day) => day.finished) },
  ]

  const first = d.funnel[0]?.count ?? 0
  const funnel = d.funnel.map((step, i) => ({
    label: FUNNEL_LABELS[step.key] ?? step.key,
    value: step.count,
    note:
      i === 0
        ? '100%'
        : `전체의 ${pct(rate(step.count, first))} · 앞 단계의 ${pct(rate(step.count, d.funnel[i - 1].count))}`,
  }))

  const actions = ['SHARE_UNIVERSE', 'INVITE_OPEN', 'SHARE_DEBATE', 'DEBATE_OPEN', 'DEBATE_PICK', 'CARD_SAVE', 'ENDING_OPEN']
  const people = AGE_GROUPS.map((age) => ({
    label: age.label,
    values: GENDERS.map(
      (g) => d.demographics.find((x) => x.ageGroup === age.value && x.gender === g.value)?.guests ?? 0,
    ),
  }))

  return (
    <>
      <h2 className={styles.sectionTitle}>한눈에 보기</h2>
      <section className={styles.card} aria-label="한눈에 보기">
        <InsightList items={insightsOf(d)} />
      </section>

      <h2 className={styles.sectionTitle}>
        최근 {days}일 <small>바로 앞 {days}일과 비교</small>
      </h2>
      <div className={styles.tiles}>
        <StatTile label="새 방문자" value={fmt(change('guests').current)} change={change('guests')} days={days} />
        <StatTile label="테스트 완료" value={fmt(change('answers').current)} change={change('answers')} days={days} />
        <StatTile label="전부 완료한 사람" value={fmt(change('finished').current)} change={change('finished')} days={days} />
        <StatTile label="공유 링크 생성" value={fmt(change('rooms').current)} change={change('rooms')} days={days} />
        <StatTile label="친구 등록" value={fmt(change('planets').current)} change={change('planets')} days={days} />
        <StatTile label="광고 노출" value={fmt(views.current)} change={views} days={days} />
        <StatTile label="광고 클릭" value={fmt(clicks.current)} change={clicks} days={days} />
        <StatTile
          label="광고 클릭률 (CTR)"
          value={pct(rate(clicks.current, views.current))}
          note={`이전 ${days}일 ${pct(rate(clicks.previous, views.previous))}`}
        />
      </div>

      <h2 className={styles.sectionTitle}>일별 추이</h2>
      <div className={styles.cards}>
        {trends.map((t) => (
          <Card key={t.title} title={t.title} size="third">
            <Trend series={[{ name: t.name, color: SERIES[0], values: t.values }]} labels={labels} />
            <DataTable head={['날짜', t.name]} rows={d.daily.map((day, i) => [day.date, t.values[i]])} />
          </Card>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>
        전환 <small>전체 기간</small>
      </h2>
      <div className={styles.cards}>
        <Card title="어디까지 왔나" sub="각 단계에 도달한 방문자 수" size="half">
          <Bars rows={funnel} unit="명" />
        </Card>
        <Card title="끝낸 테스트 수별 방문자" sub="몇 개까지 하고 멈췄는지" size="half">
          <Columns
            groups={d.progress.map((count, n) => ({ label: `${n}개`, values: [count] }))}
            series={[{ name: '방문자', color: SERIES[0] }]}
            unit="명"
          />
          <DataTable head={['끝낸 테스트', '방문자']} rows={d.progress.map((count, n) => [`${n}개`, count])} />
        </Card>
      </div>

      <h2 className={styles.sectionTitle}>
        광고 <small>질문 5번과 6번 사이 · 최근 {days}일</small>
      </h2>
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
              { name: '노출', color: SERIES[0], values: event('AD_VIEW') },
              { name: '클릭', color: SERIES[1], values: event('AD_CLICK') },
            ]}
            labels={labels}
          />
          <DataTable
            head={['날짜', '노출', '클릭', '건너뛰기']}
            rows={d.daily.map((day) => [day.date, day.events.AD_VIEW ?? 0, day.events.AD_CLICK ?? 0, day.events.AD_SKIP ?? 0])}
          />
        </Card>
        <Card title="카테고리별 광고 성과" sub="어느 테스트에서 광고가 잘 눌리는지" size="half">
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.big}`}>
              <thead>
                <tr>
                  <th>카테고리</th>
                  <th>노출</th>
                  <th>클릭</th>
                  <th>건너뛰기</th>
                  <th>CTR</th>
                  <th>건너뛴 비율</th>
                </tr>
              </thead>
              <tbody>
                {d.ads.map((ad) => (
                  <tr key={ad.category}>
                    <td>{d.categories.find((c) => c.code === ad.category)?.name ?? ad.category}</td>
                    <td>{fmt(ad.views)}</td>
                    <td>{fmt(ad.clicks)}</td>
                    <td>{fmt(ad.skips)}</td>
                    <td>{pct(rate(ad.clicks, ad.views))}</td>
                    <td>{pct(rate(ad.skips, ad.views))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <h2 className={styles.sectionTitle}>
        공유와 유입 <small>최근 {days}일</small>
      </h2>
      <div className={styles.cards}>
        <Card title="공유 · 유입 행동" sub="버튼을 누르거나 링크를 연 횟수" size="half">
          <Bars
            rows={actions.map((type) => ({
              label: EVENT_LABELS[type],
              value: change(type).current,
              note: `이전 ${days}일 ${fmt(change(type).previous)}`,
            }))}
            unit="회"
          />
        </Card>
        <Card
          title="일별 공유 링크와 친구 등록"
          size="half"
          aside={
            <Legend
              items={[
                { name: '공유 링크', color: SERIES[0], line: true },
                { name: '친구 등록', color: SERIES[1], line: true },
              ]}
            />
          }
        >
          <Trend
            series={[
              { name: '공유 링크', color: SERIES[0], values: d.daily.map((day) => day.rooms) },
              { name: '친구 등록', color: SERIES[1], values: d.daily.map((day) => day.planets) },
            ]}
            labels={labels}
          />
          <DataTable head={['날짜', '공유 링크', '친구 등록']} rows={d.daily.map((day) => [day.date, day.rooms, day.planets])} />
        </Card>
      </div>

      <h2 className={styles.sectionTitle}>카테고리와 시간대</h2>
      <div className={styles.cards}>
        <Card
          title="카테고리별 참여"
          sub="전체 기간"
          size="half"
          aside={
            <Legend
              items={[
                { name: '끝낸 사람', color: SERIES[0] },
                { name: '첫 테스트로 고른 사람', color: SERIES[1] },
              ]}
            />
          }
        >
          <Columns
            groups={d.categories.map((c) => ({ label: c.name.split(' ')[0], values: [c.participants, c.firstPicks] }))}
            series={[
              { name: '끝낸 사람', color: SERIES[0] },
              { name: '첫 테스트로 고른 사람', color: SERIES[1] },
            ]}
            unit="명"
          />
          <DataTable
            head={['카테고리', '끝낸 사람', '첫 테스트로 고른 사람']}
            rows={d.categories.map((c) => [c.name, c.participants, c.firstPicks])}
          />
        </Card>
        <Card title="시간대별 테스트 완료" sub={`최근 ${days}일 · 한국 시간`} size="half">
          <Columns
            groups={d.hours.map((count, hour) => ({ label: `${hour}시`, values: [count] }))}
            series={[{ name: '완료한 테스트', color: SERIES[0] }]}
            labelEvery={3}
            unit="건"
          />
          <DataTable head={['시간', '완료한 테스트']} rows={d.hours.map((count, hour) => [`${hour}시`, count])} />
        </Card>
      </div>

      <h2 className={styles.sectionTitle}>
        참여자 구성 <small>프로필을 입력한 방문자 · 전체 기간</small>
      </h2>
      <div className={styles.cards}>
        <Card
          title="나이대와 성별"
          size="half"
          aside={<Legend items={GENDERS.map((g, i) => ({ name: g.label, color: SERIES[i] }))} />}
        >
          <Columns groups={people} series={GENDERS.map((g, i) => ({ name: g.label, color: SERIES[i] }))} unit="명" />
        </Card>
        <Card title="그룹별 완주율" sub="프로필을 입력한 사람 중 테스트를 전부 끝낸 비율" size="half">
          <div className={styles.tableScroll}>
            <table className={`${styles.table} ${styles.big}`}>
              <thead>
                <tr>
                  <th>그룹</th>
                  <th>방문자</th>
                  <th>전부 완료</th>
                  <th>완주율</th>
                </tr>
              </thead>
              <tbody>
                {AGE_GROUPS.flatMap((age) =>
                  GENDERS.map((g) => {
                    const row = d.demographics.find((x) => x.ageGroup === age.value && x.gender === g.value)
                    return (
                      <tr key={`${age.value}-${g.value}`}>
                        <td>
                          {age.label} {g.label}
                        </td>
                        <td>{fmt(row?.guests ?? 0)}</td>
                        <td>{fmt(row?.finished ?? 0)}</td>
                        <td>{pct(rate(row?.finished ?? 0, row?.guests ?? 0))}</td>
                      </tr>
                    )
                  }),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <h2 className={styles.sectionTitle}>문항</h2>
      <div className={styles.cards}>
        <Questions d={d} />
      </div>
    </>
  )
}

// Service numbers for the operator: growth, conversion, ads, sharing and the questions.
// Outside the phone-sized app shell, and behind the admin token.
function AdminPage() {
  const [token, setToken] = useState(readToken)
  const [failed, setFailed] = useState(false)
  const [days, setDays] = useState<number>(14)

  const signOut = (rejected: boolean) => {
    storeToken('')
    setToken('')
    setFailed(rejected)
  }

  const query = useQuery({
    queryKey: ['admin', 'dashboard', token, days],
    queryFn: async () => {
      try {
        return await fetchDashboard(token, days)
      } catch (err) {
        // a token the server refuses sends the operator back to the sign-in form
        if (err instanceof HttpError && err.status === 401) signOut(true)
        throw err
      }
    },
    enabled: token !== '',
    placeholderData: keepPreviousData,
    retry: (count, err) => !(err instanceof HttpError && err.status === 401) && count < 2,
  })

  if (token === '') {
    return (
      <div className={styles.admin}>
        <Login
          failed={failed}
          onSubmit={(value) => {
            storeToken(value)
            setFailed(false)
            setToken(value)
          }}
        />
      </div>
    )
  }

  const d = query.data
  return (
    <div className={styles.admin}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.title}>나만 그래? 어드민</span>
          {d && <span className={styles.updated}>{new Date(d.generatedAt).toLocaleString('ko-KR')} 기준</span>}
          <div className={styles.periods} role="group" aria-label="기간">
            {PERIODS.map((p) => (
              <button key={p} type="button" aria-pressed={days === p} onClick={() => setDays(p)}>
                {p}일
              </button>
            ))}
          </div>
          <button type="button" className={styles.action} onClick={() => void query.refetch()}>
            새로고침
          </button>
          <button type="button" className={styles.action} onClick={() => signOut(false)}>
            나가기
          </button>
        </div>
      </header>
      <main className={styles.inner}>
        {d ? (
          <div className={`${styles.body} ${query.isFetching ? styles.stale : ''}`}>
            <Body d={d} />
          </div>
        ) : (
          <div className={styles.status} role={query.isError ? 'alert' : 'status'}>
            {query.isError ? '대시보드를 불러오지 못했어요.' : '불러오는 중…'}
          </div>
        )}
      </main>
    </div>
  )
}

export default AdminPage
