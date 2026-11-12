import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { fmt, type Insight } from './insights.ts'
import type { Change } from './api.ts'
import { SERIES } from './palette.ts'
import styles from './admin.module.css'

// A round number at or above the largest value, so axis ticks read cleanly.
function niceMax(value: number): number {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const lead = value / power
  return (lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 5 ? 5 : 10) * power
}

const ticksOf = (max: number) => (max >= 2 ? [max, max / 2, 0] : [max, 0])

const compact = (n: number) => (n >= 10000 ? `${Math.round(n / 100) / 10}K` : fmt(n))

function YAxis({ max }: { max: number }) {
  return (
    <div className={styles.yAxis} aria-hidden>
      {ticksOf(max).map((tick) => (
        <span key={tick} style={{ top: `${(1 - tick / max) * 100}%` }}>
          {compact(tick)}
        </span>
      ))}
    </div>
  )
}

function Grid({ max }: { max: number }) {
  return (
    <div className={styles.grid} aria-hidden>
      {ticksOf(max).map((tick) => (
        <span key={tick} className={tick === 0 ? styles.baseline : undefined} style={{ top: `${(1 - tick / max) * 100}%` }} />
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { name: string; color: string; line?: boolean }[] }) {
  return (
    <ul className={styles.legend}>
      {items.map((item) => (
        <li key={item.name}>
          <span className={item.line ? styles.keyLine : styles.keyBox} style={{ background: item.color }} />
          {item.name}
        </li>
      ))}
    </ul>
  )
}

// Every chart keeps a table of the same numbers, so no value is reachable by hover alone.
export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className={styles.tableView}>
      <summary>표로 보기</summary>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{typeof cell === 'number' ? fmt(cell) : cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export function Card({ title, sub, size, aside, children }: {
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

type TileProps = {
  label: string
  value: string
  // counts of this period and the one before; the delta is left out without it
  change?: Change
  days?: number
  note?: string
}

export function StatTile({ label, value, change, days, note }: TileProps) {
  let delta: ReactNode = null
  if (change) {
    const diff = change.current - change.previous
    if (change.previous === 0) {
      delta = <span className={styles.deltaFlat}>이전 {days}일 기록 없음</span>
    } else if (diff === 0) {
      delta = <span className={styles.deltaFlat}>이전 {days}일과 같음</span>
    } else {
      const percent = Math.round((Math.abs(diff) / change.previous) * 100)
      delta = (
        <span className={diff > 0 ? styles.deltaUp : styles.deltaDown}>
          {diff > 0 ? '▲' : '▼'} {percent}% <span className={styles.deltaBase}>이전 {days}일 대비</span>
        </span>
      )
    }
  }
  return (
    <div className={styles.tile}>
      <div className={styles.tileLabel}>{label}</div>
      <div className={styles.tileValue}>{value}</div>
      {delta && <div className={styles.tileDelta}>{delta}</div>}
      {note && <div className={styles.tileNote}>{note}</div>}
    </div>
  )
}

export function InsightList({ items }: { items: Insight[] }) {
  if (items.length === 0) return <p className={styles.empty}>아직 읽을 만한 데이터가 없어요.</p>
  return (
    <ul className={styles.insights}>
      {items.map((item) => (
        <li key={item.title}>
          <span className={styles.insightTitle}>{item.title}</span>
          <span className={styles.insightText}>{item.text}</span>
        </li>
      ))}
    </ul>
  )
}

type Series = { name: string; color: string; values: number[] }

// Lines over the days of the period. The pointer only has to pick a day: a hairline snaps
// to it and one tooltip lists every series. Arrow keys do the same from the keyboard.
export function Trend({ series, labels }: { series: Series[]; labels: string[] }) {
  const [at, setAt] = useState<number | null>(null)
  const count = labels.length
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)))
  const x = (i: number) => (count > 1 ? (i / (count - 1)) * 100 : 50)
  const y = (v: number) => (1 - v / max) * 100

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - box.left) / box.width
    setAt(Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1)))))
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const from = at ?? count - 1
    setAt(Math.min(count - 1, Math.max(0, from + (e.key === 'ArrowRight' ? 1 : -1))))
  }
  const middle = Math.floor((count - 1) / 2)

  return (
    <div className={styles.chart}>
      <YAxis max={max} />
      <div
        className={styles.plot}
        role="img"
        tabIndex={0}
        aria-label={`${series.map((s) => s.name).join(', ')} 일별 추이. 좌우 화살표로 날짜를 옮겨요.`}
        onPointerMove={onMove}
        onPointerLeave={() => setAt(null)}
        onFocus={() => setAt(count - 1)}
        onBlur={() => setAt(null)}
        onKeyDown={onKey}
      >
        <Grid max={max} />
        {count > 1 && (
          <svg className={styles.lines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            {series.map((s) => {
              const points = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
              return (
                <g key={s.name}>
                  {series.length === 1 && (
                    <polygon points={`0,100 ${points} 100,100`} fill={s.color} opacity={0.1} />
                  )}
                  <polyline points={points} fill="none" stroke={s.color} />
                </g>
              )
            })}
          </svg>
        )}
        {series.map((s) => (
          <span
            key={s.name}
            className={styles.dot}
            style={{ left: `${x(at ?? count - 1)}%`, top: `${y(s.values[at ?? count - 1])}%`, background: s.color }}
          />
        ))}
        {at != null && (
          <>
            <span className={styles.crosshair} style={{ left: `${x(at)}%` }} />
            <div className={`${styles.tooltip} ${x(at) > 60 ? styles.tooltipLeft : ''}`} style={{ left: `${x(at)}%` }}>
              <div className={styles.tooltipHead}>{labels[at]}</div>
              {series.map((s) => (
                <div key={s.name} className={styles.tooltipRow}>
                  <span className={styles.keyLine} style={{ background: s.color }} />
                  <b>{fmt(s.values[at])}</b>
                  <span>{s.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className={styles.xAxis} aria-hidden>
        <span>{labels[0]}</span>
        {count > 2 && <span>{labels[middle]}</span>}
        {count > 1 && <span>{labels[count - 1]}</span>}
      </div>
    </div>
  )
}

type ColumnGroup = { label: string; values: number[] }

// Columns from one baseline, one per series inside each group. The whole slot is the hover
// and focus target, and its tooltip lists every series of the group.
export function Columns({
  groups,
  series,
  labelEvery = 1,
  unit = '',
}: {
  groups: ColumnGroup[]
  series: { name: string; color: string }[]
  labelEvery?: number
  unit?: string
}) {
  const [at, setAt] = useState<number | null>(null)
  const peak = Math.max(0, ...groups.flatMap((g) => g.values))
  const max = niceMax(peak)
  return (
    <div className={styles.chart}>
      <YAxis max={max} />
      <div className={styles.plot}>
        <Grid max={max} />
        <div className={styles.columns}>
          {groups.map((group, i) => (
            <div
              key={group.label}
              className={styles.slot}
              tabIndex={0}
              role="img"
              aria-label={`${group.label}: ${group.values.map((v, s) => `${series[s].name} ${fmt(v)}${unit}`).join(', ')}`}
              onPointerEnter={() => setAt(i)}
              onPointerLeave={() => setAt(null)}
              onFocus={() => setAt(i)}
              onBlur={() => setAt(null)}
            >
              <div className={styles.bars}>
                {group.values.map((v, s) => (
                  <span
                    key={series[s].name}
                    className={`${styles.column} ${at === i ? styles.columnActive : ''}`}
                    style={{ height: `${(v / max) * 100}%`, background: series[s].color }}
                  >
                    {/* only the tallest column carries its value; the axis and tooltip carry the rest */}
                    {series.length === 1 && v === peak && v > 0 && at == null && (
                      <span className={styles.cap}>{fmt(v)}</span>
                    )}
                  </span>
                ))}
              </div>
              {at === i && (
                <div className={`${styles.tooltip} ${styles.tooltipTop} ${i > groups.length * 0.6 ? styles.tooltipLeft : ''}`}>
                  <div className={styles.tooltipHead}>{group.label}</div>
                  {group.values.map((v, s) => (
                    <div key={series[s].name} className={styles.tooltipRow}>
                      <span className={styles.keyBox} style={{ background: series[s].color }} />
                      <b>
                        {fmt(v)}
                        {unit}
                      </b>
                      <span>{series[s].name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.xLabels} aria-hidden>
        {groups.map((group, i) => (
          <span key={group.label}>{i % labelEvery === 0 ? group.label : ''}</span>
        ))}
      </div>
    </div>
  )
}

type BarRow = { label: string; value: number; note?: string }

// Ranked bars with the value at the tip. Every value is printed, so there is no tooltip.
export function Bars({ rows, color = SERIES[0], unit = '' }: { rows: BarRow[]; color?: string; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className={styles.hbars}>
      {rows.map((row) => (
        <li key={row.label}>
          <span className={styles.hbarLabel}>{row.label}</span>
          <span className={styles.hbarTrack}>
            <span className={styles.hbar} style={{ width: `${(row.value / max) * 100}%`, background: color }} />
            <span className={styles.hbarValue}>
              {fmt(row.value)}
              {unit}
            </span>
          </span>
          <span className={styles.hbarNote}>{row.note ?? ''}</span>
        </li>
      ))}
    </ul>
  )
}

// One whole split in two, beside a row that prints both shares.
export function SplitBar({ first, total, label }: { first: number; total: number; label: string }) {
  if (total === 0) return <span className={styles.splitEmpty} aria-label="응답 없음" />
  return (
    <span className={styles.split} role="img" aria-label={label} title={label}>
      {first > 0 && <span style={{ flexGrow: first, background: 'var(--side-first)' }} />}
      {total - first > 0 && <span style={{ flexGrow: total - first, background: 'var(--side-second)' }} />}
    </span>
  )
}
