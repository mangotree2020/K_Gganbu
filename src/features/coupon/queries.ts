// 쿠폰 목록 — coupons 테이블 조회 (BACKLOG #23). 다국어 title/조건, 카테고리 필터.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useLocaleStore } from '@/lib/i18n'
import { discountLabel } from '@/utils/coupon'

// 화면(coupons.tsx) 카드 표시 모델
export type CouponCard = {
  id: string
  name: string
  cat: string
  icon: string
  detail: string
  dist: string
  disc: string
  note: string
  filter: string
}

const CAT_ICON: Record<string, string> = {
  food: 'food',
  cafe: 'cafe',
  beauty: 'spa',
  activity: 'cable',
}
const CAT_LABEL: Record<string, string> = {
  food: 'Food',
  cafe: 'Cafe',
  beauty: 'Beauty',
  activity: 'Activity',
}

type Row = {
  id: string
  title_i18n: Record<string, string> | null
  discount_type: string
  discount_value: number | null
  usage_condition_i18n: Record<string, string> | null
  category: string | null
  partners: { name: string } | null
}

// 내가 발급받은 쿠폰 (coupon_issues, BACKLOG #23 My탭) — 본인 데이터만(RLS)
export type SavedCoupon = {
  id: string
  couponId: string
  name: string
  disc: string
  category: string
  status: string
  qrToken: string
  expiresAt: string
}

type IssueRow = {
  id: string
  coupon_id: string
  qr_token: string
  expires_at: string
  status: string
  coupons: {
    title_i18n: Record<string, string> | null
    discount_type: string
    discount_value: number | null
    category: string | null
  } | null
}

export function useUserCoupons() {
  const lang = useLocaleStore((s) => s.lang)
  return useQuery({
    queryKey: ['user-coupons', lang],
    queryFn: async (): Promise<SavedCoupon[]> => {
      const { data, error } = await supabase
        .from('coupon_issues')
        .select(
          'id, coupon_id, qr_token, expires_at, status, issued_at, coupons(title_i18n, discount_type, discount_value, category)',
        )
        .order('issued_at', { ascending: false })
      if (error) throw error
      return ((data ?? []) as unknown as IssueRow[]).map((r) => ({
        id: r.id,
        couponId: r.coupon_id,
        qrToken: r.qr_token,
        expiresAt: r.expires_at,
        status: r.status,
        name: r.coupons?.title_i18n?.[lang] ?? r.coupons?.title_i18n?.en ?? 'Coupon',
        disc: discountLabel(
          r.coupons?.discount_type ?? 'freebie',
          r.coupons?.discount_value ?? null,
        ),
        category: r.coupons?.category ?? 'food',
      }))
    },
  })
}

export function useCoupons() {
  const lang = useLocaleStore((s) => s.lang)
  return useQuery({
    queryKey: ['coupons', lang],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CouponCard[]> => {
      const { data, error } = await supabase
        .from('coupons')
        .select(
          'id, title_i18n, discount_type, discount_value, usage_condition_i18n, category, partners(name)',
        )
        .eq('status', 'active')
        .order('created_at', { ascending: true })
      if (error) throw error
      return ((data ?? []) as unknown as Row[]).map((c) => {
        const cat = c.category ?? 'food'
        const name = c.title_i18n?.[lang] ?? c.title_i18n?.en ?? c.partners?.name ?? 'Coupon'
        const note = c.usage_condition_i18n?.[lang] ?? c.usage_condition_i18n?.en ?? ''
        return {
          id: c.id,
          name,
          cat: CAT_LABEL[cat] ?? cat,
          icon: CAT_ICON[cat] ?? 'sell',
          detail: c.partners?.name ?? '',
          dist: '',
          disc: discountLabel(c.discount_type, c.discount_value),
          note,
          filter: cat,
        }
      })
    },
  })
}
