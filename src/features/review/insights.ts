// 리뷰 AI 요약·번역 (PRD REQ-REV-1·2) — review-insights Edge Function 호출.
// 서버가 장소×언어 단위 DB 캐시(7일)를 갖고, 클라이언트는 24h 캐시로 이중 절감.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { USE_MOCK } from '@/lib/config'
import type { PlaceReview, ReviewTarget } from './queries'

export type InsightReview = PlaceReview & { translated: string | null }
export type ReviewInsights = {
  summary: string
  reviews: InsightReview[]
  rating: number | null
  total: number
  provider: 'live' | 'cache' | 'mock'
  sources?: { google: number; naver: number } // 요약에 반영된 소스별 건수
}

// 키/네트워크 실패 폴백 — 요약 카드만 샘플 표시(번역 힌트는 없음)
export const MOCK_INSIGHTS: ReviewInsights = {
  summary:
    'Travelers love the local vibe and value for money. Staff are friendly to foreigners; expect a short wait on weekends. Parking is limited — walking or transit is easier.',
  reviews: [],
  rating: null,
  total: 0,
  provider: 'mock',
}

// 선택 장소의 AI 요약 + 번역된 리뷰 — 장소·언어 변경 시 자동 재조회
export function useReviewInsights(place: ReviewTarget | null | undefined, lang = 'en') {
  return useQuery({
    queryKey: ['review-insights', place?.id ?? null, lang],
    enabled: !!place?.name,
    staleTime: 24 * 60 * 60 * 1000, // 24h — 서버 캐시와 별도의 기기 캐시
    queryFn: async (): Promise<ReviewInsights> => {
      if (USE_MOCK || !place?.name) return MOCK_INSIGHTS
      try {
        const { data, error } = await supabase.functions.invoke('review-insights', {
          body: { name: place.name, lat: place.lat, lng: place.lng, lang },
        })
        if (error) throw error
        const r = data as ReviewInsights
        if (!r?.summary && !r?.reviews?.length) return MOCK_INSIGHTS
        return r
      } catch {
        return MOCK_INSIGHTS
      }
    },
  })
}
