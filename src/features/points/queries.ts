// 포인트 — points Edge Function 호출 (PRD REQ-PT-4, BM§3.5)
// 잔액·내역 조회 + 만보기 적립. 적립·차감은 전부 서버(원장 RPC) 경유.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/features/auth/store'

export type PointsEntry = {
  id: string
  kind: 'earn' | 'spend' | 'expire' | 'revert'
  source: 'steps' | 'stamp' | 'stamp_card' | 'challenge' | 'game' | 'gifticon' | 'admin'
  amount: number
  created_at: string
  expires_at: string | null
}

// 깐부 등급 (REQ-PT-3) — 산정·혜택 수치는 전부 서버(user_tier RPC)가 정한다.
// 앱은 표시만 하고 계산하지 않는다(등급 규칙이 두 곳에 존재하지 않도록).
export type TierKey = 'seed' | 'friend' | 'bestie' | 'gganbu'
export type UserTier = {
  tier: TierKey
  lifetime: number // 누적 적립 포인트
  trips: number // 여행 횟수(적립 활동일 30일 공백 기준)
  boost_pct: number // 적립 부스트 %
  gifticon_rate_pct: number // 기프티콘 포인트 사용 상한 %
  next_tier: TierKey | null
  next_need: number // 다음 등급까지 남은 누적 포인트
}

export const DEFAULT_TIER: UserTier = {
  tier: 'seed',
  lifetime: 0,
  trips: 0,
  boost_pct: 0,
  gifticon_rate_pct: 30,
  next_tier: 'friend',
  next_need: 500,
}

export type PointsSummary = {
  balance: number
  next_expires_at: string | null
  expiring_30d: number
  history: PointsEntry[]
  tier: UserTier | null
}

const EMPTY: PointsSummary = {
  balance: 0,
  next_expires_at: null,
  expiring_30d: 0,
  history: [],
  tier: null,
}

// 잔액·소멸 예정·최근 내역 — 게스트도 조회 가능(항상 0), 적립만 로그인 필요
export function usePointsSummary() {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['points-summary', user?.id ?? 'anon'],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<PointsSummary> => {
      const { data, error } = await supabase.functions.invoke('points', {
        body: { action: 'summary' },
      })
      if (error) throw error
      return { ...EMPTY, ...(data as Partial<PointsSummary>) }
    },
  })
}

export type EarnResult = {
  ok?: boolean
  granted?: number
  duplicate?: boolean
  capped?: boolean
  balance?: number
  error?: string
}

// 만보기 적립 — 하루 1회 서버 멱등(REQ-PD-2). 게스트는 서버가 403으로 거부.
export function useEarnSteps() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (steps: number): Promise<EarnResult> => {
      const { data, error } = await supabase.functions.invoke('points', {
        body: { action: 'earn_steps', steps },
      })
      if (error) throw error
      return data as EarnResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['points-summary'] })
    },
  })
}
