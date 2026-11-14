import { SHARE_IMAGE_HEIGHT, SHARE_IMAGE_WIDTH } from './shareImage.ts'

// What every share channel sends: the text and the link, plus the KakaoTalk card's parts.
export type Share = {
  title: string
  text: string
  url: string
  // the smaller line under the text on the KakaoTalk card
  description?: string
  // the button on the KakaoTalk card
  button: string
}

export type ShareChannel = 'kakao' | 'copy' | 'native'

type KakaoLink = { mobileWebUrl: string; webUrl: string }
type KakaoSdk = {
  init(key: string): void
  isInitialized(): boolean
  Share: {
    sendDefault(settings: object): void
    uploadImage(settings: { file: File[] }): Promise<{ infos: { original: { url: string } } }>
  }
}
declare global {
  interface Window {
    Kakao?: KakaoSdk
  }
}

const KAKAO_KEY: string | undefined = import.meta.env.VITE_KAKAO_JS_KEY
// A new version needs its own hash (developers.kakao.com > JavaScript SDK > 다운로드).
const KAKAO_SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.5/kakao.min.js'
const KAKAO_SDK_HASH = 'sha384-v6JKY3z4FUkWq21oZDHZe74YvuPk/WUrVLrDHTBojHXClOSa3iXy7sCXPY1jkFbj'

// Without a key the KakaoTalk button is left out.
export const kakaoEnabled = Boolean(KAKAO_KEY)

let sdk: Promise<KakaoSdk> | undefined

function loadKakao(): Promise<KakaoSdk> {
  sdk ??= new Promise<KakaoSdk>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = KAKAO_SDK
    script.integrity = KAKAO_SDK_HASH
    script.crossOrigin = 'anonymous'
    script.onload = () => {
      const kakao = window.Kakao
      if (!kakao) return reject(new Error('Kakao SDK missing'))
      if (!kakao.isInitialized()) kakao.init(KAKAO_KEY!)
      resolve(kakao)
    }
    script.onerror = () => reject(new Error('Kakao SDK failed to load'))
    document.head.appendChild(script)
  })
  // a failed load is tried again the next time
  sdk.catch(() => (sdk = undefined))
  return sdk
}

export type KakaoSender = (share: Share) => void

// Loads the SDK and uploads the picture ahead of the tap, so the tap itself can open
// KakaoTalk right away (browsers block a popup that opens after waiting). Without a
// picture, or when the upload fails, the message goes as plain text with a button.
export async function prepareKakao(image: Blob | null): Promise<KakaoSender> {
  const kakao = await loadKakao()
  let imageUrl: string | null = null
  if (image) {
    try {
      // Kakao keeps an uploaded picture for 100 days
      const file = new File([image], 'share.png', { type: 'image/png' })
      imageUrl = (await kakao.Share.uploadImage({ file: [file] })).infos.original.url
    } catch (err) {
      console.error(err)
    }
  }
  return ({ text, url, description, button }) => {
    const link: KakaoLink = { mobileWebUrl: url, webUrl: url }
    kakao.Share.sendDefault(
      imageUrl
        ? {
            objectType: 'feed',
            content: {
              title: text,
              description,
              imageUrl,
              imageWidth: SHARE_IMAGE_WIDTH,
              imageHeight: SHARE_IMAGE_HEIGHT,
              link,
            },
            buttons: [{ title: button, link }],
          }
        : { objectType: 'text', text: description ? `${text}\n${description}` : text, link, buttonTitle: button },
    )
  }
}

// Phones and tablets have a share sheet worth opening; on a desktop it only gets in the way.
export const canShareNatively = () =>
  typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches

// False when the visitor closed the share sheet without picking an app.
export async function shareNatively({ title, text, url }: Share): Promise<boolean> {
  try {
    await navigator.share({ title, text, url })
    return true
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return false
    throw err
  }
}

// For pages that are not served over https and in-app browsers without the clipboard API.
function copyWithSelection(value: string): boolean {
  const area = document.createElement('textarea')
  area.value = value
  area.readOnly = true
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}

// Call it straight from the tap: Safari refuses a copy that comes after waiting.
export async function copyShare({ text, url }: Share): Promise<boolean> {
  const value = `${text}\n${url}`
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return copyWithSelection(value)
  }
}
