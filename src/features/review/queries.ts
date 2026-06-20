// 장소 리뷰 (PLANNING §17) — place-reviews Edge Function(Google Places) 호출 + mock 폴백.
// 한국인(ko)/외국인(non-ko) 관점 요약 + 개별 리뷰 목록을 제공. (지도 하단 시트용)
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { USE_MOCK } from '@/lib/config'

export type PlaceReview = {
  who: string
  flag: string
  score: number
  text: string
  time: string
  lang: string
}
export type PlaceReviews = {
  rating: number | null
  total: number
  korean: { score: number; text: string } | null
  foreign: { score: number; text: string } | null
  reviews: PlaceReview[]
  provider: 'google' | 'mock'
}

// 키/네트워크 실패 시 폴백 — 관점별 대표 톤(한국어/영어/일/중)
export const MOCK_REVIEWS: PlaceReviews = {
  rating: 4.6,
  total: 128,
  korean: { score: 4.6, text: '로컬 분위기 좋고 가성비 최고! 웨이팅 있어도 재방문 의사 있어요.' },
  foreign: { score: 4.5, text: 'Hidden gem — staff spoke some English and the view was amazing.' },
  reviews: [
    {
      who: '민지',
      flag: '🇰🇷',
      score: 5,
      text: '현지인 맛집 인증! 주말엔 웨이팅 있으니 일찍 가세요.',
      time: '2일 전',
      lang: 'ko',
    },
    {
      who: 'Emily',
      flag: '🇺🇸',
      score: 5,
      text: 'Loved the atmosphere. English menu helped a lot!',
      time: '3d ago',
      lang: 'en',
    },
    {
      who: 'たけし',
      flag: '🇯🇵',
      score: 4,
      text: '景色が最高でした。写真スポットとしておすすめ。',
      time: '1週間前',
      lang: 'ja',
    },
    {
      who: '相赫',
      flag: '🇰🇷',
      score: 4,
      text: '가성비 좋아요. 주차가 조금 불편한 점만 빼면 만족.',
      time: '1주 전',
      lang: 'ko',
    },
    {
      who: 'Liwei',
      flag: '🇨🇳',
      score: 5,
      text: '风景很美，交通也方便，推荐！',
      time: '2周前',
      lang: 'zh',
    },
  ],
  provider: 'mock',
}

export type ReviewTarget = { id: string; name: string; lat: number | null; lng: number | null }

// 선택 장소의 실 리뷰 — 장소 변경 시 자동 재조회. 실패 시 mock 폴백.
export function usePlaceReviews(place: ReviewTarget | null | undefined, lang = 'en') {
  return useQuery({
    queryKey: ['place-reviews', place?.id ?? null, lang],
    enabled: !!place?.name,
    staleTime: 60 * 60 * 1000, // 1h 캐시
    queryFn: async (): Promise<PlaceReviews> => {
      if (USE_MOCK || !place?.name) return MOCK_REVIEWS
      try {
        const { data, error } = await supabase.functions.invoke('place-reviews', {
          body: { name: place.name, lat: place.lat, lng: place.lng, lang },
        })
        if (error) throw error
        const r = data as PlaceReviews
        if (!r?.reviews?.length) return MOCK_REVIEWS
        return r
      } catch {
        return MOCK_REVIEWS
      }
    },
  })
}
