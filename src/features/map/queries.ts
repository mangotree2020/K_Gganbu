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
