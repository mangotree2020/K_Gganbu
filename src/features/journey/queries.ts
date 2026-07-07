// 걷기 랭킹 (PRD REQ-LOC-4) — walk_rank RPC (닉네임 마스킹·집계값만, 개인 경로 비노출)
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type WalkRankRow = {
  rank: number
  display_name: string
  total_m: number
  journeys: number
  is_me: boolean
}

export function useWalkRank(days = 7) {
  return useQuery({
    queryKey: ['walk-rank', days],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<WalkRankRow[]> => {
      const { data, error } = await supabase.rpc('walk_rank', { p_days: days })
      if (error) throw error
      return (data ?? []) as WalkRankRow[]
    },
  })
}
