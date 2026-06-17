// 쿠폰 목록 — coupons 테이블 조회 (BACKLOG #23). 다국어 title/조건, 카테고리 필터.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useLocaleStore } from '@/lib/i18n'

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

// 할인 표시 문자열 (discount_type/value → 라벨)
function discLabel(type: string, value: number | null): string {
  if (type === 'percentage') return `${value ?? 0}% OFF`
  if (type === 'fixed') return `₩${Number(value ?? 0).toLocaleString()}`
  return 'FREE GIFT'
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
          disc: discLabel(c.discount_type, c.discount_value),
          note,
          filter: cat,
        }
      })
    },
  })
}
