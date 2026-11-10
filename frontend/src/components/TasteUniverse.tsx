import { useState, type KeyboardEvent } from 'react'
import type { PlanetDto } from '../api/rooms.ts'
import { withAnd, withRang } from '../lib/korean.ts'
import { matchLine } from '../lib/room.ts'
import styles from './TasteUniverse.module.css'
import ui from './ui.module.css'

type Props = {
  ownerName: string
  planets: PlanetDto[]
  // only the map: planets cannot be picked and the match card is left out
  preview?: boolean
}

const SIZE = 340
const CENTER = SIZE / 2
// distance from the owner: 100% match sits at MIN_ORBIT, 0% at MAX_ORBIT
const MIN_ORBIT = 56
const MAX_ORBIT = 146
const PLANET_RADIUS = 12
// golden angle: each new planet lands in the widest gap, and positions never move
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const PLANET_COLORS = ['oklch(0.78 0.1 230)', 'oklch(0.84 0.1 85)', 'oklch(0.78 0.1 165)', 'oklch(0.76 0.11 300)', 'oklch(0.78 0.1 30)']

// Fixed star field, the same on every visit.
const STARS = Array.from({ length: 46 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1
  return { x: r(1) * SIZE, y: r(2) * SIZE, size: 0.6 + r(3) * 1.2 }
})

function position(index: number, match: number): [number, number] {
  const orbit = MIN_ORBIT + ((100 - match) / 100) * (MAX_ORBIT - MIN_ORBIT)
  const angle = -Math.PI / 2 + index * GOLDEN_ANGLE
  return [CENTER + orbit * Math.cos(angle), CENTER + orbit * Math.sin(angle)]
}

const label = (p: PlanetDto) => (p.me ? `${p.name}(나)` : p.name)

// The owner in the middle and every planet around them by match. Only owner-planet
// pairs mean anything; distances between planets do not. A picked planet shows only
// its match, never the answers behind it.
function TasteUniverse({ ownerName: owner, planets, preview = false }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selected = planets.find((p) => p.id === (selectedId ?? planets.find((m) => m.me)?.id))

  const onKey = (e: KeyboardEvent, planet: PlanetDto) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    setSelectedId(planet.id)
  }

  return (
    <>
      <section className={`${styles.space} ${preview ? styles.preview : ''}`} aria-label={`${owner}의 취향 우주`}>
        <svg className={styles.chart} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {STARS.map((s, i) => (
            <circle key={i} className={styles.star} cx={s.x} cy={s.y} r={s.size} />
          ))}
          {[MIN_ORBIT, (MIN_ORBIT + MAX_ORBIT) / 2, MAX_ORBIT].map((r) => (
            <circle key={r} className={styles.orbit} cx={CENTER} cy={CENTER} r={r} />
          ))}
          {planets.map((p, i) => {
            const [x, y] = position(i, p.match)
            return (
              <line
                key={p.id}
                className={p.id === selected?.id ? styles.linkSelected : styles.link}
                x1={CENTER}
                y1={CENTER}
                x2={x}
                y2={y}
              />
            )
          })}
          <circle className={styles.sunGlow} cx={CENTER} cy={CENTER} r={40} />
          <circle className={styles.sun} cx={CENTER} cy={CENTER} r={26} />
          <text className={styles.sunLabel} x={CENTER} y={CENTER} textAnchor="middle" dominantBaseline="central">
            {owner}
          </text>
          {planets.map((p, i) => {
            const [x, y] = position(i, p.match)
            const active = p.id === selected?.id
            return (
              <g
                key={p.id}
                className={styles.planet}
                {...(preview
                  ? {}
                  : {
                      role: 'button',
                      tabIndex: 0,
                      'aria-label': `${label(p)}, 일치율 ${p.match}%`,
                      'aria-pressed': active,
                      onClick: () => setSelectedId(p.id),
                      onKeyDown: (e: KeyboardEvent) => onKey(e, p),
                    })}
              >
                {active && <circle className={styles.halo} cx={x} cy={y} r={PLANET_RADIUS + 6} />}
                <circle
                  cx={x}
                  cy={y}
                  r={PLANET_RADIUS}
                  fill={p.me ? 'var(--universe-me)' : PLANET_COLORS[i % PLANET_COLORS.length]}
                />
                <text className={styles.planetLabel} x={x} y={y + PLANET_RADIUS + 12} textAnchor="middle">
                  {label(p)}
                </text>
              </g>
            )
          })}
        </svg>
        {!preview && <p className={styles.note}>가운데에 가까울수록 {withRang(owner)} 취향이 비슷해요</p>}
      </section>

      {!preview && (
      <div className={`${ui.card} ${styles.pick}`} aria-live="polite">
        {planets.length === 0 ? (
          <p className={styles.pickEmpty}>아직 놀러 온 친구가 없어요</p>
        ) : selected ? (
          <>
            <div className={styles.pickNames}>
              {owner} ↔ {label(selected)}
            </div>
            <div className={styles.pickMatch}>
              취향 일치율 <b>{selected.match}%</b>
            </div>
            <p className={styles.pickLine}>{matchLine(selected.match)}</p>
          </>
        ) : (
          <p className={styles.pickEmpty}>행성을 눌러 {withAnd(owner)}의 일치율을 확인해보세요</p>
        )}
      </div>
      )}
    </>
  )
}

export default TasteUniverse
