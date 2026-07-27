// 테마 스탬프 카드 (PRD REQ-ST-2) — 카드 정의·진행도 조회 + 완성 보너스 수령.
// 진행도는 서버 방문 기록(stamp_visits, 본인 RLS)과 카드 구성 매장의 교집합으로 계산한다.
// 보너스 지급은 서버 재검증(complete_stamp_card RPC) 전용 — 클라이언트 계산은 표시용일 뿐이다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/store'
import { useLocaleStore } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'

export type StampCardStore = {
  partnerId: string
  name: string
  lat: number | null
  lng: number | null
  stamped: boolean
}

export type StampCard = {
  id: string
  code: string
  title: string
  desc: string
  theme: string
  bonusPoints: number
  need: number // 완성에 필요한 매장 수
  visited: number // 내가 찍은 매장 수
  stores: StampCardStore[]
  completed: boolean // 보너스 수령 완료
  claimable: boolean // 조건 충족 · 미수령
  rewardCouponId: string | null
}

type ItemRow = {
  partner_id: string
  sort_order: number | null
  partners: { name: string; lat: number | null; lng: number | null } | null
}

type CardRow = {
  id: string
  code: string
  title_i18n: Record<string, string> | null
  desc_i18n: Record<string, string> | null
  theme: string | null
  bonus_points: number | null
  required_count: number | null
  reward_coupon_id: string | null
  valid_from: string | null
  valid_until: string | null
  stamp_card_items: ItemRow[] | null
}

const pick = (m: Record<string, string> | null, lang: string) => m?.[lang] ?? m?.en ?? ''

export function useStampCards() {
  const lang = useLocaleStore((s) => s.lang)
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['stamp-cards', user?.id ?? 'anon', lang],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<StampCard[]> => {
      const [cardsRes, visitsRes, doneRes] = await Promise.all([
        supabase
          .from('stamp_cards')
          .select(
            'id, code, title_i18n, desc_i18n, theme, bonus_points, required_count, reward_coupon_id, valid_from, valid_until, stamp_card_items(partner_id, sort_order, partners(name, lat, lng))',
          )
          .eq('status', 'active'),
        supabase.from('stamp_visits').select('partner_id, created_at'),
        supabase.from('stamp_card_completions').select('card_id'),
      ])
      if (cardsRes.error) throw cardsRes.error

      const doneIds = new Set((doneRes.data ?? []).map((d: { card_id: string }) => d.card_id))
      const visits = (visitsRes.data ?? []) as { partner_id: string; created_at: string }[]

      const now = Date.now()
      return ((cardsRes.data ?? []) as unknown as CardRow[])
        .filter(
          (c) =>
            (!c.valid_from || new Date(c.valid_from).getTime() <= now) &&
            (!c.valid_until || new Date(c.valid_until).getTime() >= now),
        )
        .map((c) => {
          // 카드 유효기간 내 방문만 인정 — 서버 판정(complete_stamp_card)과 동일 규칙
          const inWindow = (iso: string) => {
            const ts = new Date(iso).getTime()
            if (c.valid_from && ts < new Date(c.valid_from).getTime()) return false
            if (c.valid_until && ts > new Date(c.valid_until).getTime()) return false
            return true
          }
          const stampedIds = new Set(
            visits.filter((v) => inWindow(v.created_at)).map((v) => v.partner_id),
          )
          const stores: StampCardStore[] = (c.stamp_card_items ?? [])
            .slice()
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((i) => ({
              partnerId: i.partner_id,
              name: i.partners?.name ?? '',
              lat: i.partners?.lat ?? null,
              lng: i.partners?.lng ?? null,
              stamped: stampedIds.has(i.partner_id),
            }))
          const visited = stores.filter((s) => s.stamped).length
          const need = c.required_count ?? stores.length
          const completed = doneIds.has(c.id)
          return {
            id: c.id,
            code: c.code,
            title: pick(c.title_i18n, lang) || c.code,
            desc: pick(c.desc_i18n, lang),
            theme: c.theme ?? 'food',
            bonusPoints: c.bonus_points ?? 0,
            need,
            visited,
            stores,
            completed,
            claimable: !completed && need > 0 && visited >= need,
            rewardCouponId: c.reward_coupon_id,
          }
        })
        .sort((a, b) => {
          // 받을 수 있는 카드 → 진행 중 → 완료 순
          const rank = (c: StampCard) => (c.claimable ? 0 : c.completed ? 2 : 1)
          return rank(a) - rank(b) || b.visited / (b.need || 1) - a.visited / (a.need || 1)
        })
    },
  })
}

export type ClaimResult = {
  ok?: boolean
  granted?: number
  capped?: boolean
  duplicate?: boolean
  coupon_id?: string | null
  balance?: number
  error?: string
}

// 완성 보너스 수령 — 서버가 방문 기록으로 재검증 후 지급(카드당 1회)
export function useClaimStampCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cardId: string): Promise<ClaimResult> => {
      const { data, error } = await supabase.functions.invoke('stamp', {
        body: { action: 'claim_card', card_id: cardId },
      })
      if (error) throw error
      return data as ClaimResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stamp-cards'] })
      qc.invalidateQueries({ queryKey: ['points-summary'] })
    },
  })
}
