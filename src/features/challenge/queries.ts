// 챌린지 보상 적립 (PRD REQ-KL-4) — 완료 시 포인트 원장 적립.
// 지급액·상한·하루 1회 멱등은 전부 서버(points EF + earn_points)가 강제한다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/store'
import type { EarnResult } from '@/features/points/queries'
import { supabase } from '@/lib/supabase'

export function useEarnChallenge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<EarnResult> => {
      const { data, error } = await supabase.functions.invoke('points', {
        body: { action: 'earn_challenge' },
      })
      if (error) throw error
      return data as EarnResult
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['points-summary'] })
      qc.invalidateQueries({ queryKey: ['challenge-stats'] })
    },
  })
}

// 서버 진도 (REQ-KL-2) — 연속 출석·최고 기록·누적 완주일의 원장은 서버(challenge_days).
// 로컬 MMKV 값은 오프라인·게스트 표시용이며, 로그인 사용자는 서버 값을 우선한다.
export type ChallengeStats = {
  streak: number
  best_streak: number
  total_days: number
  last_done: string | null
}

export function useChallengeStats() {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['challenge-stats', user?.id ?? 'anon'],
    enabled: !!user && !user.isGuest,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<ChallengeStats | null> => {
      const { data, error } = await supabase.rpc('challenge_stats')
      if (error) throw error
      return (data ?? null) as ChallengeStats | null
    },
  })
}
