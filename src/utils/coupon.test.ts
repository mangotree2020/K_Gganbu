import { discountLabel, isCouponExpired } from '@/utils/coupon'

describe('discountLabel', () => {
  it('percentage → "N% OFF"', () => {
    expect(discountLabel('percentage', 10)).toBe('10% OFF')
    expect(discountLabel('percentage', 30)).toBe('30% OFF')
  })

  it('percentage with null value → "0% OFF"', () => {
    expect(discountLabel('percentage', null)).toBe('0% OFF')
  })

  it('fixed → 천단위 콤마 + ₩', () => {
    expect(discountLabel('fixed', 5000)).toBe('₩5,000')
    expect(discountLabel('fixed', 12000)).toBe('₩12,000')
  })

  it('freebie / 미지정 → "FREE GIFT"', () => {
    expect(discountLabel('freebie', null)).toBe('FREE GIFT')
    expect(discountLabel('unknown', 5)).toBe('FREE GIFT')
  })
})

describe('isCouponExpired', () => {
  const now = Date.parse('2026-06-17T00:00:00Z')

  it('미래 만료 → 유효', () => {
    expect(isCouponExpired('2026-06-17T00:05:00Z', now)).toBe(false)
  })

  it('과거 만료 → 만료', () => {
    expect(isCouponExpired('2026-06-16T23:59:00Z', now)).toBe(true)
  })

  it('정확히 만료 시각 → 만료', () => {
    expect(isCouponExpired('2026-06-17T00:00:00Z', now)).toBe(true)
  })

  it('잘못된 날짜 → 만료(안전)', () => {
    expect(isCouponExpired('not-a-date', now)).toBe(true)
  })
})
