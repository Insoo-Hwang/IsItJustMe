import angelCardWallet from '../assets/ad/angel-card-wallet.webp'
import blackMushroomStarCase from '../assets/ad/black-mushroom-star-case.webp'
import cozyMushroomGardenCase from '../assets/ad/cozy-mushroom-garden-case.webp'
import devilCardWallet from '../assets/ad/devil-card-wallet.webp'
import mushDotCase from '../assets/ad/mush-dot-case.webp'
import mushstarDenimPouch from '../assets/ad/mushstar-denim-pouch.webp'
import musicroomPatternPouch from '../assets/ad/musicroom-pattern-pouch.webp'
import twinkleMushroomAngelCase from '../assets/ad/twinkle-mushroom-angel-case.webp'
import vintageAngelCase from '../assets/ad/vintage-angel-case.webp'
import whiteMushroomStarCase from '../assets/ad/white-mushroom-star-case.webp'

export type Ad = {
  // stored with every ad action; changing it splits the ad's numbers in the report
  id: string
  advertiser: string
  // the product name on the advertiser's store, as they wrote it; the image file is named after it
  name: string
  kind: AdKind
  image: string
  link: string
}

export type AdKind = 'case' | 'pouch' | 'wallet'

const KIND_LABELS: Record<AdKind, string> = { case: '폰케이스', pouch: '파우치', wallet: '카드지갑' }

// The product name splits into the name and the option after " - ", as the store writes it.
export const adTitle = (ad: Ad) => ad.name.split(' - ')[0]
// the option when the name has one, otherwise what kind of product it is
export const adDetail = (ad: Ad) => ad.name.split(' - ')[1] ?? KIND_LABELS[ad.kind]

// Spots an ad can be shown in. The server keeps the same list (AdPlacement).
export type AdPlacement = 'QUIZ_BREAK' | 'ANALYZING' | 'RESULT_BANNER' | 'SUMMARY_BANNER' | 'ENDING_BANNER'

export const PLACEMENT_LABELS: Record<AdPlacement, string> = {
  QUIZ_BREAK: '테스트 중간 (5번 → 6번)',
  ANALYZING: '취향 분석 중 화면',
  RESULT_BANNER: '카테고리 결과 아래',
  SUMMARY_BANNER: '종합 결과 아래',
  ENDING_BANNER: '엔딩 편지 아래',
}

// Chance that a spot shows an ad at all. Spots that stop the visitor are drawn so most
// tests run without one; banners at the bottom of a page are passed by and always show.
const CHANCE: Record<AdPlacement, number> = {
  QUIZ_BREAK: 0.3,
  ANALYZING: 0.3,
  RESULT_BANNER: 1,
  SUMMARY_BANNER: 1,
  ENDING_BANNER: 1,
}

const product = (n: string) => `https://smartstore.naver.com/swiswi/products/${n}`

export const ADS: Ad[] = [
  { id: 'twinkle-mushroom-angel-case', advertiser: 'swiswi', name: 'Twinkle mUshRoom AngeL Phone cAse - 실버 애폭시 케이스', kind: 'case', image: twinkleMushroomAngelCase, link: product('13515331720') },
  { id: 'cozy-mushroom-garden-case', advertiser: 'swiswi', name: 'Cozy mUshRoom GArden Phone cAse - 실버 애폭시 케이스', kind: 'case', image: cozyMushroomGardenCase, link: product('13515305360') },
  { id: 'mush-dot-case', advertiser: 'swiswi', name: 'Mush Dot Phone cAse - 카드 포켓 케이스', kind: 'case', image: mushDotCase, link: product('13833093868') },
  { id: 'mushstar-denim-pouch', advertiser: 'swiswi', name: 'MushStar DeniM pOuch', kind: 'pouch', image: mushstarDenimPouch, link: product('13568319776') },
  { id: 'musicroom-pattern-pouch', advertiser: 'swiswi', name: 'MusicRoom PatterN pOuch', kind: 'pouch', image: musicroomPatternPouch, link: product('13566244132') },
  { id: 'devil-card-wallet', advertiser: 'swiswi', name: 'DeviL Card walleT', kind: 'wallet', image: devilCardWallet, link: product('13566177935') },
  { id: 'angel-card-wallet', advertiser: 'swiswi', name: 'AngeL Card walleT', kind: 'wallet', image: angelCardWallet, link: product('13564917878') },
  { id: 'vintage-angel-case', advertiser: 'swiswi', name: 'Vintage AngeL Phone cAse - 애폭시 케이스', kind: 'case', image: vintageAngelCase, link: product('13515262886') },
  { id: 'white-mushroom-star-case', advertiser: 'swiswi', name: 'White mUshRoom Star Phone cAse - 애폭시 케이스', kind: 'case', image: whiteMushroomStarCase, link: product('13515191310') },
  { id: 'black-mushroom-star-case', advertiser: 'swiswi', name: 'Black mUshRoom Star Phone cAse - 애폭시 케이스', kind: 'case', image: blackMushroomStarCase, link: product('13510964726') },
]

export const findAd = (id: string) => ADS.find((ad) => ad.id === id)

const seen = new Set<string>()

// A random ad, preferring ones this visit has not shown yet so the same one does not
// come back while others wait.
export function pickAd(): Ad {
  let pool = ADS.filter((ad) => !seen.has(ad.id))
  if (pool.length === 0) {
    seen.clear()
    pool = ADS
  }
  const ad = pool[Math.floor(Math.random() * pool.length)]
  seen.add(ad.id)
  return ad
}

// An ad for the spot, or nothing for this time.
export function drawAd(placement: AdPlacement): Ad | null {
  return Math.random() < CHANCE[placement] ? pickAd() : null
}
