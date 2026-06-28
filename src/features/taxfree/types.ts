// 사후면세 환급 (#26 Phase 2) — 타입 + 환급 추정 순수 로직(단위 테스트 대상, RN 의존 없음).
import { z } from 'zod'

export type Receipt = {
  id: string
  storeName: string | null
  purchaseDate: string | null
  totalAmount: number
  currency: string
  vatRefund: number
  imagePath: string | null
  source: 'manual' | 'scanned'
  status: 'saved' | 'claimed'
  createdAt: string
}

// 수동 입력 폼
export const receiptSchema = z.object({
  storeName: z.string().trim().min(1, '상호를 입력하세요'),
  totalAmount: z.coerce.number().positive('금액을 입력하세요'),
  purchaseDate: z.string().optional(),
})
export type ReceiptFormData = z.infer<typeof receiptSchema>

// ── 한국 사후면세 환급 추정 ────────────────────────────────────────────────
// 한국 부가세 10% → 세포함가 amount 의 부가세분 = amount × 10/110 = amount/11.
// 외국인 환급 최소 구매액(per 영수증) = ₩15,000. 그 미만은 환급 대상 아님.
// 실제 환급액은 매장·환급사 수수료에 따라 부가세분보다 작다 → 보수적 추정 계수 적용.
export const MIN_ELIGIBLE_KRW = 15000
const REFUND_FACTOR = 0.9 // 부가세분 대비 실수령 추정(수수료 차감 근사)

// 단일 영수증 환급 추정액(원 단위 반올림). 최소 구매액 미만이면 0.
export function estimateRefund(totalAmount: number): number {
  if (!Number.isFinite(totalAmount) || totalAmount < MIN_ELIGIBLE_KRW) return 0
  const vat = totalAmount / 11
  return Math.round(vat * REFUND_FACTOR)
}

export function isEligible(totalAmount: number): boolean {
  return Number.isFinite(totalAmount) && totalAmount >= MIN_ELIGIBLE_KRW
}

// 영수증 목록 → 합계(총 지출·총 예상환급·대상 건수)
export function summarize(receipts: Receipt[]): {
  totalSpent: number
  totalRefund: number
  eligibleCount: number
} {
  return receipts.reduce(
    (acc, r) => {
      acc.totalSpent += r.totalAmount
      acc.totalRefund += r.vatRefund
      if (isEligible(r.totalAmount)) acc.eligibleCount += 1
      return acc
    },
    { totalSpent: 0, totalRefund: 0, eligibleCount: 0 },
  )
}
