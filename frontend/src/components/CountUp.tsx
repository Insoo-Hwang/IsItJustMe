import { useEffect, useState } from 'react'

type Props = {
  // where it starts, 0 unless given
  from?: number
  to: number
  // ms before it starts counting
  after?: number
  duration?: number
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// A number that counts toward `to`, easing out. Shows the final value right away when the
// visitor asked for less motion.
function CountUp({ from = 0, to, after = 0, duration = 700 }: Props) {
  const [value, setValue] = useState(() => (reduced() ? to : from))
  useEffect(() => {
    if (reduced()) return
    let frame = 0
    const start = performance.now() + after
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / duration))
      setValue(Math.round(from + (to - from) * (1 - (1 - p) ** 3)))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [from, to, after, duration])
  return <>{value}</>
}

export default CountUp
