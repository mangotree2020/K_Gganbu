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

// 마지막 발급분(로컬 캐시) — 만료 전이면 QR 즉시 표시(Edge Function 왕복·콜드스타트 지연 제거).
// one-time 토큰은 사용/만료 전까지 유효하므로 재발급 없이 그대로 재사용해도 안전.
export function getCachedIssue(couponId: string): CouponIssue | null {
  const raw = storage.getString(KEY(couponId))
  if (!raw) return null
  try {
    const issue = JSON.parse(raw) as CouponIssue
    // 남은 시간이 10초 미만이면 새로 발급(표시 직후 만료 방지)
    if (new Date(issue.expires_at).getTime() - Date.now() > 10_000) return issue
    return null
  } catch {
    return null
  }
}

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
  } catch {
    // 오프라인/미인증: 마지막 발급분을 캐시에서 표시(오프라인 QR), 없으면 mock 토큰
    const cached = storage.getString(KEY(couponId))
    if (cached) return JSON.parse(cached) as CouponIssue
    return {
      id: 'offline',
      qr_token: `MOCK-${couponId}-${Date.now()}`,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      status: 'issued',
    }
  }
}
