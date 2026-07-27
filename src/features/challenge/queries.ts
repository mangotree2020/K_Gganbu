// 챌린지 보상 적립 (PRD REQ-KL-4) — 완료 시 포인트 원장 적립.
// 지급액·상한·하루 1회 멱등은 전부 서버(points EF + earn_points)가 강제한다.
import { useMutation, useQueryClient } from '@tanstack/react-query'

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
    },
  })
}
