import styles from './RarityHexagon.module.css'

type Axis = { label: string; value: number }

type Props = {
  // 0 ~ 1 per axis, clockwise from the top
  axes: Axis[]
}

const SIZE = 300
const CENTER = SIZE / 2
const RADIUS = 96
const RINGS = [0.25, 0.5, 0.75, 1]

function point(i: number, count: number, r: number): [number, number] {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)]
}

function polygon(values: number[]): string {
  return values.map((v, i) => point(i, values.length, RADIUS * v).join(',')).join(' ')
}

// Radar chart of the minority-pick share per category. Colors come from the tier class.
function RarityHexagon({ axes }: Props) {
  const count = axes.length
  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={axes.map((a) => `${a.label} ${Math.round(a.value * 100)}%`).join(', ')}
    >
      {RINGS.map((r) => (
        <polygon key={r} className={styles.ring} points={polygon(axes.map(() => r))} />
      ))}
      {axes.map((a, i) => {
        const [x, y] = point(i, count, RADIUS)
        return <line key={a.label} className={styles.spoke} x1={CENTER} y1={CENTER} x2={x} y2={y} />
      })}
      <polygon className={styles.area} points={polygon(axes.map((a) => Math.max(0.04, a.value)))} />
      {axes.map((a, i) => {
        const [x, y] = point(i, count, RADIUS * Math.max(0.04, a.value))
        return <circle key={a.label} className={styles.dot} cx={x} cy={y} r={4} />
      })}
      {axes.map((a, i) => {
        const [x, y] = point(i, count, RADIUS + 30)
        return (
          <text key={a.label} className={styles.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle">
            <tspan x={x} dy="-0.5em">
              {a.label}
            </tspan>
            <tspan x={x} dy="1.25em" className={styles.value}>
              {Math.round(a.value * 100)}%
            </tspan>
          </text>
        )
      })}
    </svg>
  )
}

export default RarityHexagon
