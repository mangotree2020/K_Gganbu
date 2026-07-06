// 기프티콘 스토어 (PRD REQ-GS-1·2·3, BM§3.5) — mock-first
// 실 데이터는 KT 기프티쇼 비즈 계약(O-6) 후 Edge Function 'gifticon' 경유로 교체.
// 가드레일(BM§3.5): 카탈로그는 저마진 상품권·금액권이 아닌 일반상품(할인율 6~12%) 중심으로 구성.
import type { AppLang } from '@/lib/i18n'

export type GifticonProduct = {
  id: string
  brand: string
  nameI18n: Record<string, string> // {en, ko, ja, zh-CN, zh-TW}
  price: number // 판매가(원)
  category: 'convenience' | 'cafe' | 'chicken' | 'bakery' | 'icecream'
  emoji: string // 카드 썸네일 (실 카탈로그 전환 시 이미지 URL로 교체)
}

// 포인트 혼합 결제 사용 상한 30% (REQ-GS-2 — 등급별 상향은 REQ-PT-3에서)
export const POINT_USE_RATE = 0.3

export const pointUsableFor = (price: number): number => Math.floor(price * POINT_USE_RATE)

// mock 카탈로그 — 외국인 여행자 사용 빈도 높은 전국 브랜드 일반상품 (BM§3.5 카탈로그 원칙)
const MOCK_CATALOG: GifticonProduct[] = [
  {
    id: 'g1',
    brand: 'CU',
    nameI18n: {
      en: 'Snack set ₩5,000',
      ko: '간식 세트 5,000원권',
      ja: 'スナックセット5,000W',
      'zh-CN': '零食套装5,000元券',
      'zh-TW': '零食套組5,000元券',
    },
    price: 5000,
    category: 'convenience',
    emoji: '🏪',
  },
  {
    id: 'g2',
    brand: 'MEGA Coffee',
    nameI18n: {
      en: 'Americano (ICE)',
      ko: '아이스 아메리카노',
      ja: 'アイスアメリカーノ',
      'zh-CN': '冰美式咖啡',
      'zh-TW': '冰美式咖啡',
    },
    price: 2000,
    category: 'cafe',
    emoji: '🧋',
  },
  {
    id: 'g3',
    brand: 'BHC',
    nameI18n: {
      en: 'Fried chicken set',
      ko: '후라이드 치킨 세트',
      ja: 'フライドチキンセット',
      'zh-CN': '炸鸡套餐',
      'zh-TW': '炸雞套餐',
    },
    price: 20000,
    category: 'chicken',
    emoji: '🍗',
  },
  {
    id: 'g4',
    brand: 'Paris Baguette',
    nameI18n: {
      en: 'Bakery ₩10,000',
      ko: '베이커리 10,000원권',
      ja: 'ベーカリー10,000W',
      'zh-CN': '烘焙10,000元券',
      'zh-TW': '烘焙10,000元券',
    },
    price: 10000,
    category: 'bakery',
    emoji: '🥐',
  },
  {
    id: 'g5',
    brand: 'Baskin Robbins',
    nameI18n: {
      en: 'Single regular',
      ko: '싱글 레귤러',
      ja: 'シングルレギュラー',
      'zh-CN': '单球冰淇淋',
      'zh-TW': '單球冰淇淋',
    },
    price: 4000,
    category: 'icecream',
    emoji: '🍨',
  },
]

export function productName(p: GifticonProduct, lang: AppLang): string {
  return p.nameI18n[lang] ?? p.nameI18n.en
}

// mock-first: 계약 전이므로 항상 mock 반환. 실 전환 시 Edge Function 'gifticon' 호출로 교체.
export async function getGifticonCatalog(): Promise<{
  products: GifticonProduct[]
  isMock: boolean
}> {
  return { products: MOCK_CATALOG, isMock: true }
}
