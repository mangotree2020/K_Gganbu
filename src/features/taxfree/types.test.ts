// 환급 추정 순수 로직 단위 테스트 (#26 Phase 2)
import { estimateRefund, isEligible, summarize, MIN_ELIGIBLE_KRW, type Receipt } from './types'

describe('estimateRefund', () => {
  it('최소 구매액(₩15,000) 미만은 환급 0', () => {
    expect(estimateRefund(14999)).toBe(0)
    expect(estimateRefund(0)).toBe(0)
  })

  it('최소 구매액 이상은 부가세분(amount/11)의 90% 추정', () => {
    // 110,000 → 부가세 10,000 → ×0.9 = 9,000
    expect(estimateRefund(110000)).toBe(9000)
    // 15,000 → 1363.6 × 0.9 ≈ 1227
    expect(estimateRefund(15000)).toBe(Math.round((15000 / 11) * 0.9))
  })

  it('비정상 입력은 0', () => {
    expect(estimateRefund(NaN)).toBe(0)
    expect(estimateRefund(-100)).toBe(0)
  })
})

describe('isEligible', () => {
  it('경계값 처리', () => {
    expect(isEligible(MIN_ELIGIBLE_KRW)).toBe(true)
    expect(isEligible(MIN_ELIGIBLE_KRW - 1)).toBe(false)
  })
})

describe('summarize', () => {
  it('총 지출·총 환급·대상 건수 집계', () => {
    const receipts = [
      { totalAmount: 110000, vatRefund: 9000 },
      { totalAmount: 10000, vatRefund: 0 }, // 미달
      { totalAmount: 22000, vatRefund: 1800 },
    ] as Receipt[]
    const s = summarize(receipts)
    expect(s.totalSpent).toBe(142000)
    expect(s.totalRefund).toBe(10800)
    expect(s.eligibleCount).toBe(2)
  })

  it('빈 목록', () => {
    expect(summarize([])).toEqual({ totalSpent: 0, totalRefund: 0, eligibleCount: 0 })
  })
})
