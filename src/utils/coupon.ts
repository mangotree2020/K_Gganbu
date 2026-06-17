// 쿠폰 표시 순수 로직 (BACKLOG #3/#23) — UI/네트워크 의존 없음, 단위 테스트 대상
export type DiscountType = 'percentage' | 'fixed' | 'freebie' | string

// 할인 표시 문자열: percentage → "N% OFF", fixed → "₩N,NNN", 그 외 → "FREE GIFT"
export function discountLabel(type: DiscountType, value: number | null): string {
  if (type === 'percentage') return `${value ?? 0}% OFF`
  if (type === 'fixed') return `₩${Number(value ?? 0).toLocaleString()}`
  return 'FREE GIFT'
}

// 발급 쿠폰 만료 여부 (TTL) — expiresAt(ISO) 기준
export function isCouponExpired(expiresAt: string, now: number = Date.now()): boolean {
  const t = new Date(expiresAt).getTime()
  if (Number.isNaN(t)) return true
  return t <= now
}
