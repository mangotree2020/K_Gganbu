// 티켓 (PLANNING §6 "티켓/쿠폰 지갑", §19 ticket, §20 tickets) — mock-first.
// 초기엔 외부 예매 아웃링크(outlinkUrl), 2차 인앱 결제(§24 payment-router)로 확장.
import { storage } from '@/lib/mmkv'
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
  // 이용 장소 좌표 — 홈 추천 LBS 딜 매칭용(Google Find Place 지오코딩 값)
  lat?: number | null
  lng?: number | null
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
    lat: 35.0763876,
    lng: 129.0236199,
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
    lat: 35.1594845,
    lng: 129.1701682,
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
    lat: 35.147551,
    lng: 129.1302088,
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
    lat: 35.158284,
    lng: 129.1727672,
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
    lat: 35.1682338,
    lng: 129.1295279,
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

// ── 내 티켓 (Travel Wallet 지갑 — 소유한 바우처) ──
// 현재는 아웃링크 예매(외부 결제)라 실 소유 데이터가 없다 → 기본 빈 목록(가짜 소유 표시 금지).
// 인앱 결제(REQ-PAY-1) 완성 시 결제 완료 훅에서 saveMyTicket으로 적재하는 계약만 먼저 확정.

export type MyTicket = {
  id: string
  title: string
  category: TicketCategory
  price: number
  purchasedAt: string // ISO
  voucher: string // 바우처 코드(오프라인 표시용)
  status: 'active' | 'used' | 'expired'
}

const WALLET_TICKETS_KEY = 'wallet:tickets'

export async function getMyTickets(): Promise<MyTicket[]> {
  try {
    const raw = storage.getString(WALLET_TICKETS_KEY)
    return raw ? (JSON.parse(raw) as MyTicket[]) : []
  } catch {
    return []
  }
}

// 결제 완료 시 호출(payment-router 연동 지점) — 지갑에 바우처 적재
export async function saveMyTicket(tk: MyTicket): Promise<void> {
  const cur = await getMyTickets()
  storage.set(WALLET_TICKETS_KEY, JSON.stringify([tk, ...cur.filter((x) => x.id !== tk.id)]))
}
