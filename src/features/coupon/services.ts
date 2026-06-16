// 쿠폰 서비스 — coupon Edge Function(발급/검증) 호출 + 오프라인 캐시 (mock-first)
import { supabase } from '@/lib/supabase'
import { storage } from '@/lib/mmkv'

export type CouponIssue = {
  id: string
  qr_token: string
  expires_at: string
  status: string
}

const KEY = (couponId: string) => `coupon_issue:${couponId}`

// 발급: Edge Function 호출 → 실패 시 로컬 캐시(오프라인 QR) 폴백
export async function issueCoupon(couponId: string): Promise<CouponIssue> {
  try {
    const { data, error } = await supabase.functions.invoke('coupon', {
      body: { action: 'issue', coupon_id: couponId },
    })
    if (error) throw error
    if (data?.issue) {
      storage.set(KEY(couponId), JSON.stringify(data.issue))
      return data.issue as CouponIssue
    }
    throw new Error(data?.message ?? '발급 실패')
  } catch (e) {
    // 오프라인/미인증: 마지막 발급분을 캐시에서 표시(오프라인 QR), 없으면 mock 토큰
    const cached = storage.getString(KEY(couponId))
    if (cached) return JSON.parse(cached) as CouponIssue
    return {
      id: 'offline',
      qr_token: `MOCK-${couponId}-${Date.now()}`,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      status: 'issued',
      ...(e ? {} : {}),
    }
  }
}
