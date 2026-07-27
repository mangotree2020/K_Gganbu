// 내 리뷰 (PLANNING Phase 3 "리뷰") — mock-first. 실 연동 시 reviews 테이블(RLS) 교체.
import { USE_MOCK } from '@/lib/config'
import { supabase } from '@/lib/supabase'
import { withRetry } from '@/lib/withRetry'

type ReviewRow = {
  id: string
  place_name: string
  cat: string | null
  rating: number
  body: string | null
  created_at: string
}

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
  const { data, error } = await supabase
    .from('reviews')
    .select('id, place_name, cat, rating, body, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map((r: ReviewRow) => ({
    id: r.id,
    place: r.place_name,
    cat: r.cat ?? 'sights',
    rating: r.rating,
    text: r.body ?? '',
    date: r.created_at.slice(0, 10),
  }))
}

// 리뷰 작성 (UX_REVIEW §4-4) — 쿠폰 사용 직후 1탭 별점이 주 경로.
// ref_id(쿠폰 발급 id)가 있으면 사용 1건당 1리뷰로 서버 unique 가 중복을 막는다.
export async function addReview(input: {
  placeName: string
  rating: number
  cat?: string
  body?: string
  placeKey?: string | null
  refId?: string | null
}): Promise<boolean> {
  const { data: me } = await supabase.rpc('current_user_id')
  if (!me) return false
  const { error } = await supabase.from('reviews').insert({
    user_id: me,
    place_name: input.placeName,
    place_key: input.placeKey ?? null,
    cat: input.cat ?? null,
    rating: input.rating,
    body: input.body ?? null,
    source: input.refId ? 'coupon_redeem' : 'manual',
    ref_id: input.refId ?? null,
  })
  // 중복(같은 쿠폰 사용 건)은 성공으로 취급 — 사용자에게는 이미 남긴 것이므로 오류가 아니다
  if (error && !error.message.includes('duplicate')) throw error
  return true
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
