// 내 리뷰 (PLANNING Phase 3 "리뷰") — mock-first. 실 연동 시 reviews 테이블(RLS) 교체.
import { withRetry } from '@/lib/withRetry'
import { USE_MOCK } from '@/lib/config'

export type Review = {
  id: string
  place: string
  cat: string // PlaceThumb 카테고리
  rating: number // 1~5
  text: string
  date: string // YYYY-MM-DD
}

const MOCK: Review[] = [
  {
    id: 'r1',
    place: 'Mipojeong',
    cat: 'seafood',
    rating: 5,
    text: 'Fresh sashimi with an unbeatable sunset view. Staff used the translation card kindly.',
    date: '2026-06-15',
  },
  {
    id: 'r2',
    place: 'Bada View Cafe',
    cat: 'cafe',
    rating: 4,
    text: 'Great ocean view, a bit crowded on weekends. The QR menu had English.',
    date: '2026-06-14',
  },
  {
    id: 'r3',
    place: 'Gamcheon Culture Village',
    cat: 'sights',
    rating: 5,
    text: 'So photogenic — allow 1.5h. Lots of stairs, wear comfy shoes.',
    date: '2026-06-13',
  },
]

async function fetchReal(): Promise<Review[]> {
  // TODO: reviews 테이블(본인 RLS) 조회로 교체
  throw new Error('reviews real API not configured')
}

// 내 리뷰 목록 — 실패 시 mock 폴백 (mock-first)
export async function getMyReviews(): Promise<Review[]> {
  if (USE_MOCK) return MOCK
  try {
    return await withRetry(fetchReal)
  } catch {
    return MOCK
  }
}
