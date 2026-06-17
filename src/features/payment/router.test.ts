import { selectProvider } from '@/features/payment/rules'
import type { PaymentRequest } from '@/features/payment/types'

// 결제 라우팅 규칙 검증 (PLANNING §24)
const base: PaymentRequest = { ticketId: 't1', amount: 15000, currency: 'KRW', method: 'card' }

describe('selectProvider', () => {
  it('코나 선불카드는 konaplate로 라우팅', () => {
    const d = selectProvider({ ...base, method: 'kona_prepaid' })
    expect(d.provider).toBe('konaplate')
    expect(d.reason).toBe('kona_prepaid_method')
  })

  it('해외 법인 정산 상품은 stripe로 라우팅', () => {
    const d = selectProvider({ ...base, settlement: 'overseas' })
    expect(d.provider).toBe('stripe')
  })

  it('해외 발행 카드는 eximbay(국내 정산)로 라우팅', () => {
    const d = selectProvider({ ...base, cardCountry: 'JP' })
    expect(d.provider).toBe('eximbay')
  })

  it('국내 카드 기본 결제는 toss로 라우팅', () => {
    const d = selectProvider({ ...base, cardCountry: 'KR' })
    expect(d.provider).toBe('toss')
  })

  it('선불카드는 정산 조건보다 우선', () => {
    const d = selectProvider({ ...base, method: 'kona_prepaid', settlement: 'overseas' })
    expect(d.provider).toBe('konaplate')
  })
})
