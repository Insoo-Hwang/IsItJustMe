import { useEffect, useState } from 'react'
import { cardBlob, drawTasteCard, type TasteCardData } from '../lib/tasteCard.ts'
import Icon from './Icon.tsx'
import styles from './TasteCard.module.css'
import { track } from '../lib/track.ts'
import ui from './ui.module.css'

const FILE_NAME = '나만그래-취향카드.png'

// Preview of the taste card image with save and full-screen view.
function TasteCard({ data }: { data: TasteCardData }) {
  const [url, setUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  // the page builds a new object every render; redraw only when a value changes
  const key = JSON.stringify(data)

  useEffect(() => {
    let created = ''
    let cancelled = false
    // canvas only uses fonts that are already loaded
    void document.fonts.ready
      .then(() => {
        const canvas = document.createElement('canvas')
        drawTasteCard(canvas, JSON.parse(key) as TasteCardData)
        return cardBlob(canvas)
      })
      .then((blob) => {
        if (cancelled) return
        created = URL.createObjectURL(blob)
        setUrl(created)
      })
      .catch((err) => console.error(err))
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [key])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const save = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = FILE_NAME
    a.click()
    track('CARD_SAVE')
  }

  const show = () => {
    setZoomed(false)
    setOpen(true)
  }

  const alt = `${data.tier} 취향 카드`

  return (
    <section className={`${ui.card} ${styles.card}`} aria-label="취향 카드">
      <h2 className={ui.cardTitle}>내 취향 카드</h2>
      <p className={styles.description}>캡처하거나 저장해서 친구에게 자랑해봐.</p>
      <button type="button" className={styles.preview} onClick={show} disabled={!url} aria-label="취향 카드 크게 보기">
        {url ? <img src={url} alt={alt} /> : <div className={styles.placeholder} />}
      </button>
      <div className={styles.actions}>
        <button type="button" className={ui.secondary} onClick={save} disabled={!url}>
          <Icon name="download" size={20} />
          저장
        </button>
        <button type="button" className={ui.primary} onClick={show} disabled={!url}>
          <Icon name="zoom_in" size={20} />
          크게 보기
        </button>
      </div>

      {open && url && (
        <div className={styles.viewer} role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)}>
          <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="닫기">
            <Icon name="close" size={26} />
          </button>
          {/* tap the image to switch between fitting the screen and its full size */}
          <div className={`${styles.stage} ${zoomed ? styles.zoomed : ''}`}>
            <img
              src={url}
              alt={alt}
              onClick={(e) => {
                e.stopPropagation()
                setZoomed(!zoomed)
              }}
            />
          </div>
          <p className={styles.hint}>{zoomed ? '눌러서 화면에 맞추기' : '눌러서 확대 · 길게 눌러 저장'}</p>
        </div>
      )}
    </section>
  )
}

export default TasteCard
