// 결제 라우팅 (PLANNING §24) — 카드 발행국/통화/수단/정산 조건으로 provider 선택.
// 앱은 selectProvider로 사유만 파악하고, 실제 결제는 payment-router Edge Function 호출.
import { supabase } from '@/lib/supabase'
import { adapters } from './providers'
import { selectProvider } from './rules'
import type { Payment, PaymentRequest } from './types'

export { selectProvider }

// 결제 실행 — payment-router Edge Function 경유(provider 추상화).
// 키 미설정/오류 시 로컬 어댑터 mock 폴백(mock-first).
export async function routePayment(req: PaymentRequest): Promise<Payment> {
  const decision = selectProvider(req)
  const base: Payment = {
    id: `pay_${req.ticketId}`,
    ticketId: req.ticketId,
    provider: decision.provider,
    amount: req.amount,
    currency: req.currency,
    pgTxId: null,
    routingReason: decision.reason,
    status: 'pending',
  }
  try {
    const { data, error } = await supabase.functions.invoke('payment-router', { body: req })
    if (error) throw error
    if (data?.pgTxId) {
      return {
        ...base,
        pgTxId: data.pgTxId as string,
        status: (data.status as Payment['status']) ?? 'paid',
      }
    }
    throw new Error('no pg result')
  } catch {
    // mock 폴백 — 선택된 provider 어댑터로 결정적 mock 처리
    const r = await adapters[decision.provider].charge(req)
    return { ...base, pgTxId: r.pgTxId, status: r.status }
  }
}
