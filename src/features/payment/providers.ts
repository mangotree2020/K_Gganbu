// provider 어댑터 (PLANNING §24) — 추가/교체 용이한 어댑터 패턴.
// 실제 PG 호출·webhook은 payment-router Edge Function(서버)에서 처리하며,
// 클라이언트 어댑터는 mock 응답만 제공한다(키 클라이언트 미노출).
import type { PaymentAdapter, PaymentProvider } from './types'

// 결정적 mock 트랜잭션 ID (Math.random 미사용 — 재현 가능)
function mockTxId(provider: PaymentProvider, ticketId: string): string {
  return `mock_${provider}_${ticketId}`
}

function makeAdapter(provider: PaymentProvider): PaymentAdapter {
  return {
    provider,
    charge: async (req) => ({ pgTxId: mockTxId(provider, req.ticketId), status: 'paid' }),
  }
}

// 1차: Eximbay/Toss(해외카드·국내정산), 2차: Stripe(해외법인)/코나플레이트(선불카드)
export const adapters: Record<PaymentProvider, PaymentAdapter> = {
  eximbay: makeAdapter('eximbay'),
  toss: makeAdapter('toss'),
  stripe: makeAdapter('stripe'),
  konaplate: makeAdapter('konaplate'),
}
