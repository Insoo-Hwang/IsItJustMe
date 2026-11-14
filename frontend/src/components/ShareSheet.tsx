import { useEffect, useState } from 'react'
import {
  canShareNatively,
  copyShare,
  kakaoEnabled,
  prepareKakao,
  shareNatively,
  type KakaoSender,
  type Share,
  type ShareChannel,
} from '../lib/share.ts'
import { drawShareImage, type ShareImageData } from '../lib/shareImage.ts'
import { cardBlob } from '../lib/tasteCard.ts'
import { showToast } from '../lib/toast.ts'
import Icon from './Icon.tsx'
import sheet from './NameSheet.module.css'
import styles from './ShareSheet.module.css'

type Props = {
  share: Share
  // the picture on the KakaoTalk message; without one it goes as text
  image?: ShareImageData
  // the picture's data is still loading
  imagePending?: boolean
  // a channel was used (not when the visitor backed out of it)
  onShare?: (channel: ShareChannel) => void
  onClose: () => void
}

// A speech bubble with a tail, drawn here: the Material icon font has no KakaoTalk mark.
function KakaoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3.6c-5.2 0-9.4 3.3-9.4 7.4 0 2.6 1.7 4.9 4.3 6.2l-.9 3.3c-.1.4.3.7.6.5l3.9-2.6c.5.1 1 .1 1.5.1 5.2 0 9.4-3.3 9.4-7.5S17.2 3.6 12 3.6z" />
    </svg>
  )
}

// Bottom sheet with the ways to share a link: KakaoTalk, copy, and the phone's share sheet.
function ShareSheet({ share, image, imagePending, onShare, onClose }: Props) {
  // undefined while the SDK loads and the picture uploads, null when that failed
  const [sender, setSender] = useState<KakaoSender | null>()
  const [preview, setPreview] = useState<string | null>(null)
  // the caller builds a new object every render; redraw only when a value changes
  const imageKey = image ? JSON.stringify(image) : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!kakaoEnabled || imagePending) return
    let cancelled = false
    let created = ''
    const drawn = imageKey
      ? // canvas only uses fonts that are already loaded
        document.fonts.ready
          .then(() => {
            const canvas = document.createElement('canvas')
            drawShareImage(canvas, JSON.parse(imageKey) as ShareImageData)
            return cardBlob(canvas)
          })
          .then((blob) => {
            if (!cancelled) {
              created = URL.createObjectURL(blob)
              setPreview(created)
            }
            return blob
          })
          .catch((err) => {
            console.error(err)
            return null
          })
      : Promise.resolve(null)
    void drawn
      .then(prepareKakao)
      .then((send) => !cancelled && setSender(() => send))
      .catch((err) => {
        console.error(err)
        if (!cancelled) setSender(null)
      })
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [imageKey, imagePending])

  const done = (channel: ShareChannel) => {
    onShare?.(channel)
    onClose()
  }

  // runs inside the tap, with everything loaded: a popup opened after waiting gets blocked
  const kakao = () => {
    try {
      if (!sender) throw new Error('KakaoTalk share is not available')
      sender(share)
      done('kakao')
    } catch (err) {
      console.error(err)
      showToast('카카오톡을 열지 못했어요. 링크 복사를 써주세요')
    }
  }

  const copy = async () => {
    if (await copyShare(share)) {
      showToast('링크를 복사했어요')
      done('copy')
    } else {
      showToast('링크를 복사하지 못했어요')
    }
  }

  const native = async () => {
    try {
      if (await shareNatively(share)) done('native')
    } catch (err) {
      console.error(err)
      showToast('공유하지 못했어요. 링크 복사를 써주세요')
    }
  }

  return (
    <div className={sheet.backdrop} onClick={onClose}>
      <div
        className={sheet.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="share-sheet-title" className={sheet.title}>
          어디로 공유할까요?
        </h2>
        <p className={sheet.description}>{share.text}</p>
        {kakaoEnabled && image && (
          <div className={styles.preview}>
            {preview ? <img src={preview} alt="카카오톡에 보일 이미지" /> : <div className={styles.placeholder} />}
          </div>
        )}
        <div className={styles.channels}>
          {kakaoEnabled && (
            <button type="button" className={styles.channel} onClick={kakao} disabled={sender === undefined}>
              <span className={`${styles.mark} ${styles.kakao}`}>
                <KakaoMark />
              </span>
              {sender === undefined ? '준비 중…' : '카카오톡'}
            </button>
          )}
          <button type="button" className={styles.channel} onClick={() => void copy()}>
            <span className={styles.mark}>
              <Icon name="link" size={26} />
            </span>
            링크 복사
          </button>
          {canShareNatively() && (
            <button type="button" className={styles.channel} onClick={() => void native()}>
              <span className={styles.mark}>
                <Icon name="more_horiz" size={26} />
              </span>
              다른 앱
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ShareSheet
