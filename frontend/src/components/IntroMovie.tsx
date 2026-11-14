import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { CATEGORIES, QUESTION_COUNT } from '../data/categories.ts'
import CountUp from './CountUp.tsx'
import Icon from './Icon.tsx'
import KakaoMark from './KakaoMark.tsx'
import styles from './IntroMovie.module.css'

type Props = {
  // the movie faded out: skipped or the start button
  onDone: () => void
}

// How long each scene plays before moving on, in ms. The last scene waits for the button.
const SCENES = [2200, 2800, 2400, 4800]
const SLIDE = SCENES[3] / 4

// From the home page's crowd, so the dot that lights up here is the one seen there.
const COLUMNS = 10
const ROWS = 6
const GAP = 34
const ME = { col: 7, row: 2 }

const STREAM = [
  ['민초', '좋아', '싫어'],
  ['여행은', '계획형', '즉흥형'],
  ['답장은', '바로', '몰아서'],
  ['노는 건', '혼자서도 잘', '같이가 좋아'],
  ['아침 알람', '하나면 충분', '여러 개'],
  ['탕수육', '부먹', '찍먹'],
  ['연락은', '자주', '가끔'],
  ['쇼핑은', '바로 결제', '장바구니'],
  ['주말엔', '밖으로', '집에서'],
]

const STARS = Array.from({ length: 40 }, (_, i) => {
  const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1
  return { x: r(1) * 300, y: r(2) * 300, size: 0.6 + r(3) * 1.3 }
})

const PLANET_COLORS = ['oklch(0.78 0.1 230)', 'oklch(0.84 0.1 85)', 'oklch(0.78 0.1 165)', 'oklch(0.76 0.11 300)', 'oklch(0.78 0.1 30)']

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` })

// Lines of a caption, one after another.
function Caption({ lines, at = 150, step = 700 }: { lines: ReactNode[]; at?: number; step?: number }) {
  return (
    <p className={styles.caption}>
      {lines.map((line, i) => (
        <span key={i} className={styles.line} style={delay(at + i * step)}>
          {line}
        </span>
      ))}
    </p>
  )
}

// Planets turning around a sun, each ring at its own pace.
function Orbits({ sun, newcomer = false }: { sun: ReactNode; newcomer?: boolean }) {
  const rings = [
    { r: 62, planets: [0, 200], speed: 9 },
    { r: 98, planets: [80, 250], speed: 15 },
    { r: 132, planets: [30, 150, 300], speed: 24 },
  ]
  return (
    <svg className={styles.space} viewBox="0 0 300 300" aria-hidden>
      {STARS.map((s, i) => (
        <circle key={i} className={styles.star} cx={s.x} cy={s.y} r={s.size} style={delay((i % 9) * 260)} />
      ))}
      {rings.map((ring, i) => (
        <g key={ring.r}>
          <circle className={styles.orbit} cx={150} cy={150} r={ring.r} />
          <g className={styles.turn} style={{ animationDuration: `${ring.speed}s` }}>
            {ring.planets.map((deg, j) => {
              const a = (deg * Math.PI) / 180
              return (
                <circle
                  key={deg}
                  className={styles.planet}
                  cx={150 + ring.r * Math.cos(a)}
                  cy={150 + ring.r * Math.sin(a)}
                  r={7 + ((i + j) % 3) * 2}
                  fill={PLANET_COLORS[(i * 2 + j) % PLANET_COLORS.length]}
                  style={delay(200 + (i * 2 + j) * 120)}
                />
              )
            })}
          </g>
        </g>
      ))}
      {newcomer && (
        <g className={styles.newcomer}>
          <circle className={styles.newcomerHalo} cx={150 + 98 * Math.cos(-0.7)} cy={150 + 98 * Math.sin(-0.7)} r={15} />
          <circle cx={150 + 98 * Math.cos(-0.7)} cy={150 + 98 * Math.sin(-0.7)} r={10} fill="var(--accent)" />
        </g>
      )}
      {sun}
    </svg>
  )
}

function Universe() {
  return (
    <Orbits
      sun={
        <>
          <circle className={styles.meGlow} cx={150} cy={150} r={12} />
          <circle className={styles.meDot} cx={150} cy={150} r={12} />
        </>
      }
    />
  )
}

function Stream() {
  return (
    <div className={styles.stream} aria-hidden>
      {STREAM.map(([topic, a, b], i) => (
        <span
          key={topic}
          className={styles.card}
          // rows spread top to bottom; a few cards are on screen at once
          style={{ top: `${6 + ((i * 41) % 80)}%`, animationDelay: `${i * 190}ms`, animationDuration: `${1400 + (i % 3) * 300}ms` }}
        >
          <span className={styles.cardTopic}>{topic}</span>
          <span className={styles.cardA}>{a}</span>
          <span className={styles.cardB}>{b}</span>
        </span>
      ))}
      <span className={styles.person}>
        <span className={styles.personRing} />
      </span>
    </div>
  )
}

function Crowd() {
  return (
    <svg className={styles.crowd} viewBox={`0 0 ${COLUMNS * GAP} ${ROWS * GAP}`} aria-hidden>
      {Array.from({ length: ROWS }, (_, row) =>
        Array.from({ length: COLUMNS }, (_, col) => {
          const cx = GAP / 2 + col * GAP
          const cy = GAP / 2 + row * GAP
          const me = col === ME.col && row === ME.row
          return (
            <g key={`${col},${row}`}>
              {me && <circle className={styles.crowdPulse} cx={cx} cy={cy} r={8} />}
              <circle
                className={me ? styles.crowdMe : styles.crowdDot}
                cx={cx}
                cy={cy}
                r={me ? 8 : 6}
                // the second delay is for dimming, once everyone is there
                style={me ? undefined : { animationDelay: `${(col + row) * 35}ms, 1300ms` }}
              />
            </g>
          )
        }),
      )}
    </svg>
  )
}


const HEX = [0.75, 0.45, 0.9, 0.55, 0.8, 0.4]
const hexPoints = (values: number[]) =>
  values
    .map((v, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 3
      return `${60 + 46 * v * Math.cos(a)},${60 + 46 * v * Math.sin(a)}`
    })
    .join(' ')

// Four results, sliding past one after another.
function Previews() {
  const at = (i: number) => i * SLIDE
  return (
    <div className={styles.previews} aria-hidden>
      <div className={styles.slide} style={{ ...delay(at(0)), animationDuration: `${SLIDE}ms` }}>
        <div className={`${styles.screen} ${styles.screenDark}`}>
          <Orbits newcomer sun={<circle cx={150} cy={150} r={20} fill="white" />} />
        </div>
        <span className={styles.slideLabel}>친구들이 모이는 취향 우주</span>
      </div>

      <div className={styles.slide} style={{ ...delay(at(1)), animationDuration: `${SLIDE}ms` }}>
        <div className={styles.screen}>
          <svg className={styles.hex} viewBox="0 0 120 120">
            {[1, 0.5].map((r) => (
              <polygon key={r} className={styles.hexRing} points={hexPoints(HEX.map(() => r))} />
            ))}
            <polygon className={styles.hexArea} points={hexPoints(HEX)} style={delay(at(1) + 250)} />
          </svg>
        </div>
        <span className={styles.slideLabel}>카테고리별 내 취향</span>
      </div>

      <div className={styles.slide} style={{ ...delay(at(2)), animationDuration: `${SLIDE}ms` }}>
        <div className={`${styles.screen} ${styles.vs}`}>
          <span className={styles.vsPrompt}>답장은?</span>
          {[
            { label: '바로', rate: 38, side: styles.barA },
            { label: '몰아서', rate: 62, side: styles.barB, friend: true },
          ].map((bar) => (
            <span key={bar.label} className={styles.vsRow}>
              <span className={styles.vsHead}>
                <span>
                  {bar.label}
                  {bar.friend && (
                    <span className={styles.friendTag} style={delay(at(2) + 200)}>
                      친구
                    </span>
                  )}
                </span>
                <b>
                  <CountUp to={bar.rate} after={at(2) + 300} duration={600} />%
                </b>
              </span>
              <span className={styles.track}>
                <span className={bar.side} style={{ width: `${bar.rate}%`, ...delay(at(2) + 300) }} />
              </span>
            </span>
          ))}
        </div>
        <span className={styles.slideLabel}>친구와 VS 대결</span>
      </div>

      <div className={styles.slide} style={{ ...delay(at(3)), animationDuration: `${SLIDE}ms` }}>
        <div className={`${styles.screen} ${styles.sheet}`}>
          <span className={styles.sheetTitle}>어디로 공유할까요?</span>
          <span className={styles.sheetRow}>
            <span className={styles.channel}>
              <span className={`${styles.mark} ${styles.kakao}`} style={delay(at(3) + 380)}>
                <KakaoMark size={20} />
              </span>
              <span className={styles.swap}>
                <span className={styles.before} style={delay(at(3) + 380)}>
                  준비 중…
                </span>
                <span className={styles.after} style={delay(at(3) + 380)}>
                  카카오톡
                </span>
              </span>
            </span>
            <span className={styles.channel}>
              <span className={styles.mark}>
                <Icon name="link" size={20} />
              </span>
              링크 복사
            </span>
            <span className={styles.channel}>
              <span className={styles.mark}>
                <Icon name="more_horiz" size={20} />
              </span>
              다른 앱
            </span>
          </span>
        </div>
        <span className={styles.slideLabel}>카카오톡으로 바로 공유</span>
      </div>
    </div>
  )
}

// The opening before the first test: what the tests add up to, in about 12 seconds.
// Tap to move on, or skip it all.
function IntroMovie({ onDone }: Props) {
  const [scene, setScene] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const last = SCENES.length

  useEffect(() => {
    if (scene >= last) return
    const timer = setTimeout(() => setScene(scene + 1), SCENES[scene])
    return () => clearTimeout(timer)
  }, [scene, last])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(onDone, 450)
    return () => clearTimeout(timer)
  }, [leaving, onDone])

  const next = () => scene < last && setScene(scene + 1)

  return (
    <div
      className={`${styles.movie} ${leaving ? styles.leaving : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="나만 그래? 소개"
      onClick={next}
    >
      <div className={styles.top}>
        <div className={styles.progress} aria-hidden>
          {SCENES.map((ms, i) => (
            <span key={i} className={styles.segment}>
              <span
                className={i < scene ? styles.filled : i === scene ? styles.filling : undefined}
                style={i === scene ? { animationDuration: `${ms}ms` } : undefined}
              />
            </span>
          ))}
        </div>
        <button
          type="button"
          className={styles.skip}
          onClick={(e) => {
            e.stopPropagation()
            setLeaving(true)
          }}
        >
          건너뛰기
        </button>
      </div>

      <div key={scene} className={styles.scene}>
        {scene === 0 && (
          <>
            <div className={styles.visual}>
              <Universe />
            </div>
            <Caption lines={['세상엔 정말 많은 취향이 있어.']} />
          </>
        )}
        {scene === 1 && (
          <>
            <div className={styles.visual}>
              <Stream />
            </div>
            <Caption lines={['사소해 보여도, 하나씩 모이면', '꽤 선명한 ‘나’가 돼.']} at={200} step={1100} />
          </>
        )}
        {scene === 2 && (
          <>
            <div className={styles.visual}>
              <Crowd />
            </div>
            <Caption lines={['그럼 내 취향은,', '얼마나 흔할까?']} at={300} step={900} />
          </>
        )}
        {scene === 3 && (
          <>
            <div className={styles.visual}>
              <Previews />
            </div>
            <Caption
              lines={['끝까지 하면,', '내 취향의 위치도, 닮은 사람도, 친구와의 차이도 볼 수 있어.']}
              at={100}
              step={600}
            />
          </>
        )}
        {scene === last && (
          <div className={styles.cta}>
            <span className={styles.ctaDot} aria-hidden />
            <h2 className={styles.ctaTitle}>이제, 내 취향을 알아볼까?</h2>
            <p className={styles.ctaSub}>
              {CATEGORIES.length}가지 주제, {CATEGORIES.length * QUESTION_COUNT}개의 선택.
              <br />
              마지막엔 더 많은 결과가 기다리고 있어.
            </p>
            <button
              type="button"
              className={styles.ctaButton}
              onClick={(e) => {
                e.stopPropagation()
                setLeaving(true)
              }}
            >
              첫 번째 취향 시작하기
              <Icon name="arrow_forward" size={20} />
            </button>
          </div>
        )}
      </div>

      {scene < last && <p className={styles.hint}>화면을 누르면 넘어가요</p>}
    </div>
  )
}

export default IntroMovie
