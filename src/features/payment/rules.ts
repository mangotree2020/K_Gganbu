// 결제 라우팅 규칙 (PLANNING §24) — 순수 함수(외부 의존 없음, 단위 테스트 대상).
import type { PaymentRequest, RoutingDecision } from './types'

// 우선순위: 코나 선불카드 → 해외법인 정산(Stripe) → 해외카드(Eximbay) → 기본(Toss)
export function selectProvider(req: PaymentRequest): RoutingDecision {
  if (req.method === 'kona_prepaid') {
    return { provider: 'konaplate', reason: 'kona_prepaid_method' }
  }
  if (req.settlement === 'overseas') {
    return { provider: 'stripe', reason: 'overseas_settlement' }
  }
  if (req.cardCountry && req.cardCountry !== 'KR') {
    return { provider: 'eximbay', reason: 'foreign_card_domestic_settle' }
  }
  return { provider: 'toss', reason: 'default_domestic' }
}
