// 여행 일정 추천 (PLANNING §6 "여행 일정 추천", §19 itinerary) — mock-first.
// 실 연동 시 AI 깐부(gganbu) 일정 생성 + TourAPI 코스 데이터로 교체 가능한 구조.
import { withRetry } from '@/lib/withRetry'
import { USE_MOCK } from '@/lib/config'

export type ItinDuration = 'quick' | 'half' | 'full'
export type ItinTheme = 'family' | 'couple' | 'kpop' | 'cruise'

export type ItinStop = {
  time: string
  place: string
  sub: string // "카테고리 · 소요시간"
  cat: string // PlaceThumb 카테고리
}

export type Itinerary = {
  id: string
  title: string
  duration: ItinDuration
  theme: ItinTheme
  region: string
  stops: ItinStop[]
}

// 부산 1차 큐레이션 (MVP). place 이름은 데이터(영문) 기준 — chrome만 i18n.
const MOCK: Itinerary[] = [
  {
    id: 'gamcheon-quick',
    title: 'Gamcheon → Jagalchi → BIFF',
    duration: 'quick',
    theme: 'couple',
    region: 'Busan',
    stops: [
      {
        time: '09:30',
        place: 'Gamcheon Culture Village',
        sub: 'Photo spot · ~60min',
        cat: 'sights',
      },
      { time: '11:00', place: 'Jagalchi Fish Market', sub: 'Seafood · ~60min', cat: 'seafood' },
      { time: '12:30', place: 'BIFF Square street food', sub: 'Lunch · ~45min', cat: 'market' },
    ],
  },
  {
    id: 'haeundae-half',
    title: 'Haeundae Half-day Highlights',
    duration: 'half',
    theme: 'family',
    region: 'Busan',
    stops: [
      { time: '10:00', place: 'Haeundae Beach', sub: 'Walk · ~40min', cat: 'beach' },
      { time: '11:00', place: 'SEA LIFE Aquarium', sub: 'Family · ~80min', cat: 'sights' },
      { time: '13:00', place: 'Dongbaek Island trail', sub: 'Coastal walk · ~50min', cat: 'beach' },
      { time: '14:30', place: 'Ocean-view cafe', sub: 'Coffee · ~40min', cat: 'cafe' },
    ],
  },
  {
    id: 'kpop-shopping',
    title: 'K-POP & Shopping in Seomyeon',
    duration: 'half',
    theme: 'kpop',
    region: 'Busan',
    stops: [
      {
        time: '13:00',
        place: 'Seomyeon Underground Mall',
        sub: 'Shopping · ~70min',
        cat: 'market',
      },
      { time: '14:30', place: 'LINE Friends Store', sub: 'K-character · ~40min', cat: 'market' },
      { time: '15:30', place: 'K-POP album shop', sub: 'Merch · ~40min', cat: 'market' },
      { time: '16:30', place: 'Dessert cafe', sub: 'Break · ~40min', cat: 'cafe' },
    ],
  },
  {
    id: 'couple-sunset',
    title: 'Gwangalli Sunset for Two',
    duration: 'half',
    theme: 'couple',
    region: 'Busan',
    stops: [
      { time: '16:30', place: 'Gwangalli Beach', sub: 'Sunset walk · ~50min', cat: 'beach' },
      { time: '17:30', place: 'Marine City skyline', sub: 'Photo · ~40min', cat: 'sights' },
      { time: '18:30', place: 'Seaside dinner', sub: 'Dinner · ~70min', cat: 'seafood' },
      { time: '20:00', place: 'Bridge night view cafe', sub: 'Night view · ~50min', cat: 'cafe' },
    ],
  },
  {
    id: 'busan-full',
    title: 'Busan Full-day Classic',
    duration: 'full',
    theme: 'family',
    region: 'Busan',
    stops: [
      {
        time: '09:00',
        place: 'Haedong Yonggungsa Temple',
        sub: 'Seaside temple · ~80min',
        cat: 'sights',
      },
      { time: '11:30', place: 'Songjeong Beach', sub: 'Relax · ~50min', cat: 'beach' },
      { time: '13:00', place: 'Gijang seafood lunch', sub: 'Lunch · ~70min', cat: 'seafood' },
      {
        time: '15:00',
        place: 'Gamcheon Culture Village',
        sub: 'Photo spot · ~70min',
        cat: 'sights',
      },
      { time: '17:30', place: 'Gwangalli Beach', sub: 'Sunset · ~60min', cat: 'beach' },
    ],
  },
  {
    id: 'cruise-port',
    title: 'Cruise Port Day Course',
    duration: 'quick',
    theme: 'cruise',
    region: 'Busan',
    stops: [
      {
        time: '09:30',
        place: 'Gamcheon Culture Village',
        sub: 'Photo spot · ~60min',
        cat: 'sights',
      },
      { time: '11:00', place: 'Jagalchi Fish Market', sub: 'Seafood · ~60min', cat: 'seafood' },
      { time: '12:30', place: 'BIFF Square + street food', sub: 'Lunch · ~45min', cat: 'market' },
      { time: '13:30', place: 'Return to Busan Port', sub: '30min buffer included', cat: 'sights' },
    ],
  },
]

async function fetchReal(): Promise<Itinerary[]> {
  // TODO: gganbu Edge Function 일정 생성 / TourAPI 코스 연동으로 교체
  throw new Error('itinerary real API not configured')
}

// 추천 일정 목록 — 실패 시 mock 폴백 (mock-first 원칙, withRetry 재시도)
export async function getItineraries(): Promise<Itinerary[]> {
  if (USE_MOCK) return MOCK
  try {
    return await withRetry(fetchReal)
  } catch {
    return MOCK
  }
}
