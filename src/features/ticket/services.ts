// 티켓 (PLANNING §6 "티켓/쿠폰 지갑", §19 ticket, §20 tickets) — mock-first.
// 초기엔 외부 예매 아웃링크(outlinkUrl), 2차 인앱 결제(§24 payment-router)로 확장.
import { withRetry } from '@/lib/withRetry'
import { USE_MOCK } from '@/lib/config'

export type TicketCategory = 'attraction' | 'tour' | 'show' | 'transport'

export type Ticket = {
  id: string
  title: string
  category: TicketCategory
  provider: string
  price: number // KRW
  currency: 'KRW'
  thumb: string // PlaceThumb 카테고리
  outlinkUrl: string // 초기 외부 예매 링크
}

// 부산 1차 큐레이션 (MVP). 외국인 대상 인기 티켓.
const MOCK: Ticket[] = [
  {
    id: 'songdo-cable',
    title: 'Songdo Marine Cable Car',
    category: 'attraction',
    provider: 'Klook',
    price: 15000,
    currency: 'KRW',
    thumb: 'cable',
    outlinkUrl: 'https://www.klook.com/',
  },
  {
    id: 'xthe-sky',
    title: 'BUSAN X the SKY Observatory',
    category: 'attraction',
    provider: 'KKday',
    price: 27000,
    currency: 'KRW',
    thumb: 'sights',
    outlinkUrl: 'https://www.kkday.com/',
  },
  {
    id: 'cruise-night',
    title: 'Gwangan Bridge Night Cruise',
    category: 'tour',
    provider: 'Trip.com',
    price: 25000,
    currency: 'KRW',
    thumb: 'cruise',
    outlinkUrl: 'https://www.trip.com/',
  },
  {
    id: 'haeundae-train',
    title: 'Haeundae Blue Line Beach Train',
    category: 'transport',
    provider: 'Klook',
    price: 7000,
    currency: 'KRW',
    thumb: 'beach',
    outlinkUrl: 'https://www.klook.com/',
  },
  {
    id: 'spa-land',
    title: 'Shinsegae Spa Land Pass',
    category: 'attraction',
    provider: 'KKday',
    price: 20000,
    currency: 'KRW',
    thumb: 'spa',
    outlinkUrl: 'https://www.kkday.com/',
  },
  {
    id: 'nanta-show',
    title: 'NANTA Show Busan',
    category: 'show',
    provider: 'Trip.com',
    price: 40000,
    currency: 'KRW',
    thumb: 'sights',
    outlinkUrl: 'https://www.trip.com/',
  },
]

async function fetchReal(): Promise<Ticket[]> {
  // TODO: tickets 테이블 / 파트너 API 연동으로 교체
  throw new Error('ticket real API not configured')
}

// 티켓 목록 — 실패 시 mock 폴백 (mock-first 원칙)
export async function getTickets(): Promise<Ticket[]> {
  if (USE_MOCK) return MOCK
  try {
    return await withRetry(fetchReal)
  } catch {
    return MOCK
  }
}
