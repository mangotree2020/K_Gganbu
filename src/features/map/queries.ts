// 장소(POI) — TourAPI Edge Function 호출 + mock 폴백 (mock-first)
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { storage } from '@/lib/mmkv'
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
// TourAPI contentTypeId(Kor/Eng 서비스) → 앱 카테고리. 네이버/구글 지도 수준의 다양한 필터 지원.
function toCat(contentTypeId?: string): string {
  switch (contentTypeId) {
    case '39': // 음식점(Kor)
    case '82': // 음식점(Eng)
      return 'food'
    case '12': // 관광지(Kor)
    case '76': // 관광지(Eng)
      return 'sights'
    case '14': // 문화시설(Kor)
    case '78': // 문화시설(Eng)
      return 'culture'
    case '15': // 축제공연행사(Kor)
    case '85': // 축제공연행사(Eng)
      return 'festival'
    case '28': // 레포츠(Kor)
    case '75': // 레포츠(Eng)
      return 'leisure'
    case '32': // 숙박(Kor)
    case '80': // 숙박(Eng)
      return 'stay'
    case '38': // 쇼핑(Kor)
    case '79': // 쇼핑(Eng)
      return 'shopping'
    case '25': // 여행코스(Kor)
    case '77': // 여행코스(Eng)
      return 'course'
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

// POI 결과 — provider로 실데이터(tourapi)/폴백(mock) 구분 (배지 표시용)
export type PoiResult = { pois: Poi[]; provider: 'tourapi' | 'mock' }

// mock 폴백이 24h 캐시에 고착되는 것 방지 — mock이면 30초마다 재시도, 실데이터 오면 중단.
// (일시적 네트워크 실패로 홈/지도가 하루 종일 샘플 데이터에 묶이는 버그의 근본 수정)
const retryWhileMock = (q: { state: { data?: PoiResult } }) =>
  q.state.data?.provider === 'mock' ? 30_000 : false

export function usePlaces(lang = 'en', rows = 12) {
  return useQuery({
    queryKey: ['places', lang, rows],
    staleTime: 24 * 60 * 60 * 1000, // 24h 캐시 (PLANNING §17)
    refetchInterval: retryWhileMock,
    queryFn: async (): Promise<PoiResult> => {
      // 실패 시: 마지막 성공 결과(MMKV) → 없으면 mock
      const offlineFallback = (): PoiResult => {
        const raw = storage.getString(`home:pois:${lang}`)
        if (raw) {
          try {
            return { pois: JSON.parse(raw) as Poi[], provider: 'tourapi' }
          } catch {
            // 캐시 손상 — mock으로
          }
        }
        return { pois: MOCK_POIS, provider: 'mock' }
      }
      try {
        const { data, error } = await supabase.functions.invoke('places', {
          body: { lang, areaCode: 6, rows },
        })
        if (error) throw error
        const places = (data?.places ?? []) as Record<string, string>[]
        if (!places.length) return offlineFallback()
        const pois = places
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
        storage.set(`home:pois:${lang}`, JSON.stringify(pois))
        return { pois, provider: 'tourapi' }
      } catch {
        return offlineFallback()
      }
    },
  })
}

// 지도 마커용 — 좌표가 있는 POI만 (TourAPI 실데이터, PLANNING §17).
// contentTypeId 지정 시 해당 카테고리만 조회(필터용).
// 마지막 성공 POI를 MMKV에 보관 — 오프라인/선내 저속망 폴백 (REQ-CR-2)
const POI_CACHE_KEY = (lang: string, ct?: string) => `map:pois:${lang}:${ct ?? 'all'}`

export function useMapPois(lang = 'en', rows = 20, contentTypeId?: string) {
  return useQuery({
    queryKey: ['map-pois', lang, rows, contentTypeId ?? 'all'],
    staleTime: 24 * 60 * 60 * 1000,
    refetchInterval: retryWhileMock, // mock 고착 방지 — 네트워크 복구 시 자동 실데이터 전환
    placeholderData: keepPreviousData, // 카테고리 전환 시 이전 결과 유지(깜빡임 방지)
    queryFn: async (): Promise<PoiResult> => {
      // 네트워크 실패 시: 마지막 성공 결과(실데이터) → 없으면 mock
      const offlineFallback = (): PoiResult => {
        const raw = storage.getString(POI_CACHE_KEY(lang, contentTypeId))
        if (raw) {
          try {
            return { pois: JSON.parse(raw) as Poi[], provider: 'tourapi' }
          } catch {
            // 캐시 손상 — mock으로
          }
        }
        return { pois: MOCK_POIS, provider: 'mock' }
      }
      try {
        const { data, error } = await supabase.functions.invoke('places', {
          body: { lang, areaCode: 6, rows, contentTypeId },
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
        if (mapped.length) {
          storage.set(POI_CACHE_KEY(lang, contentTypeId), JSON.stringify(mapped))
          return { pois: mapped, provider: 'tourapi' }
        }
        return offlineFallback()
      } catch {
        return offlineFallback()
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
