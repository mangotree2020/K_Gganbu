// 장소(POI) — TourAPI Edge Function 호출 + mock 폴백 (mock-first)
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type Poi = {
  id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  imageUrl: string | null
  tel: string | null
  cat: string // 앱 썸네일 카테고리
}

// TourAPI contentTypeId → 앱 카테고리(PlaceThumb) 매핑
function toCat(contentTypeId?: string): string {
  switch (contentTypeId) {
    case '39':
    case '82':
      return 'seafood' // 음식점
    case '12':
    case '76':
      return 'sights' // 관광지
    case '14':
    case '78':
      return 'cafe' // 문화시설
    case '15':
    case '85':
      return 'village' // 축제/행사
    default:
      return 'sights'
  }
}

const MOCK_POIS: Poi[] = [
  {
    id: 'm1',
    name: 'Haeundae Beach',
    address: 'Haeundae-gu, Busan',
    lat: 35.158,
    lng: 129.16,
    imageUrl: null,
    tel: null,
    cat: 'beach',
  },
  {
    id: 'm2',
    name: 'Gamcheon Culture Village',
    address: 'Saha-gu, Busan',
    lat: 35.097,
    lng: 129.01,
    imageUrl: null,
    tel: null,
    cat: 'village',
  },
  {
    id: 'm3',
    name: 'Jagalchi Market',
    address: 'Jung-gu, Busan',
    lat: 35.096,
    lng: 129.03,
    imageUrl: null,
    tel: null,
    cat: 'seafood',
  },
  {
    id: 'm4',
    name: 'Gwangalli Beach',
    address: 'Suyeong-gu, Busan',
    lat: 35.153,
    lng: 129.118,
    imageUrl: null,
    tel: null,
    cat: 'beach',
  },
]

export function usePlaces(lang = 'en', rows = 12) {
  return useQuery({
    queryKey: ['places', lang, rows],
    staleTime: 24 * 60 * 60 * 1000, // 24h 캐시 (PLANNING §17)
    queryFn: async (): Promise<Poi[]> => {
      try {
        const { data, error } = await supabase.functions.invoke('places', {
          body: { lang, areaCode: 6, rows },
        })
        if (error) throw error
        const places = (data?.places ?? []) as Record<string, string>[]
        if (!places.length) return MOCK_POIS
        return places
          .filter((p) => p.imageUrl) // 이미지 있는 항목 우선
          .map((p) => ({
            id: p.id,
            name: p.name,
            address: p.address ?? null,
            lat: p.lat ? Number(p.lat) : null,
            lng: p.lng ? Number(p.lng) : null,
            imageUrl: p.imageUrl ?? null,
            tel: p.tel ?? null,
            cat: toCat(p.contentTypeId),
          }))
      } catch {
        return MOCK_POIS
      }
    },
  })
}

// 지도 마커용 — 좌표가 있는 POI만 (TourAPI 실데이터, PLANNING §17)
export function useMapPois(lang = 'en', rows = 20) {
  return useQuery({
    queryKey: ['map-pois', lang, rows],
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<Poi[]> => {
      try {
        const { data, error } = await supabase.functions.invoke('places', {
          body: { lang, areaCode: 6, rows },
        })
        if (error) throw error
        const places = (data?.places ?? []) as Record<string, string>[]
        const mapped = places
          .map((p) => ({
            id: p.id,
            name: p.name,
            address: p.address ?? null,
            lat: p.lat ? Number(p.lat) : null,
            lng: p.lng ? Number(p.lng) : null,
            imageUrl: p.imageUrl ?? null,
            tel: p.tel ?? null,
            cat: toCat(p.contentTypeId),
          }))
          .filter((p) => p.lat && p.lng) // 좌표 필수
        return mapped.length ? mapped : MOCK_POIS
      } catch {
        return MOCK_POIS
      }
    },
  })
}

// Naver 길찾기 (PLANNING §17) — 현재위치 → 목적지 경로
export type LatLng = { latitude: number; longitude: number }
export type RouteResult = {
  path: LatLng[]
  distance: number // meters
  duration: number // ms
  provider: 'naver' | 'mock'
}

export async function fetchRoute(start: LatLng, goal: LatLng): Promise<RouteResult> {
  try {
    const { data, error } = await supabase.functions.invoke('naver-directions', {
      body: { start, goal },
    })
    if (error) throw error
    if (data?.path?.length) {
      return {
        path: data.path,
        distance: data.distance ?? 0,
        duration: data.duration ?? 0,
        provider: data.provider ?? 'naver',
      }
    }
    throw new Error('no_path')
  } catch {
    // 폴백: 직선 경로
    return { path: [start, goal], distance: 0, duration: 0, provider: 'mock' }
  }
}

// Naver 지역 검색 (PLANNING §13) — 키워드 → 장소+좌표
export type NaverPoi = {
  id: string
  name: string
  category: string
  address: string
  lat: number
  lng: number
}

export function useNaverSearch(query: string, enabled = true) {
  return useQuery({
    queryKey: ['naver-search', query],
    enabled: enabled && query.trim().length > 0,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<NaverPoi[]> => {
      const { data, error } = await supabase.functions.invoke('naver-search', {
        body: { query, display: 5 },
      })
      if (error) throw error
      return (data?.items ?? []) as NaverPoi[]
    },
  })
}
