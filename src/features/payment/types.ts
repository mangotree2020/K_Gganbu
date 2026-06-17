// 결제 라우팅 플랫폼 타입 (PLANNING §24) — provider 무관 단일 원장 + 어댑터 계약.
// 앱은 provider를 모르고 payment-router Edge Function만 호출한다(키/검증 서버 처리).

export type PaymentProvider = 'eximbay' | 'toss' | 'stripe' | 'konaplate'

export type PaymentMethod = 'card' | 'kona_prepaid'

// 정산 귀속: 국내 법인 / 해외 법인 (상품·파트너 조건)
export type Settlement = 'domestic' | 'overseas'

export type PaymentRequest = {
  ticketId: string
  amount: number
  currency: string // ISO 4217 (KRW/USD/JPY…)
  method: PaymentMethod
  cardCountry?: string // 카드 발행국 ISO 3166 (KR/JP/CN…)
  settlement?: Settlement // 상품의 정산 요건
}

// 라우팅 결정 — 어떤 provider로 보낼지 + 사유(원장 routing_reason에 기록)
export type RoutingDecision = {
  provider: PaymentProvider
  reason: string
}

// provider 무관 단일 원장 행 (PLANNING §24 payments 테이블)
export type Payment = {
  id: string
  ticketId: string
  provider: PaymentProvider
  amount: number
  currency: string
  pgTxId: string | null
  routingReason: string
  status: 'pending' | 'paid' | 'failed' | 'refunded'
}

// provider 어댑터 공통 계약 (services/payment/providers.ts)
export type PaymentAdapter = {
  provider: PaymentProvider
  // 실제 PG 호출은 Edge Function(서버)에서 수행 — 여기선 계약·mock만
  charge: (req: PaymentRequest) => Promise<{ pgTxId: string; status: Payment['status'] }>
}
