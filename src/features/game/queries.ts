// 게임 점수·랭킹·뱃지 (PRD REQ-GM-2) — "부산에서 플레이한 사람끼리" 겨루는 여행 맥락 랭킹.
// 점수는 클라이언트 신고 값이지만 포인트 적립은 서버가 이미 상한으로 캡하므로,
// 조작으로 얻을 수 있는 것은 랭킹 표시뿐이다(DB check 로 비정상 값만 차단).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/store'
import { useOnboardingStore } from '@/features/onboarding/store'
import { supabase } from '@/lib/supabase'

export type GameKind = 'tetris' | 'rps' | 'ddakji'

export type GameRankRow = {
  rank: number
  display_name: string
  best_score: number
  plays: number
  is_me: boolean
}

export type GameBadges = {
  tetris_plays: number
  tetris_best: number
  rps_wins: number
  badges: string[]
}

// 지역 랭킹 — region 지정 시 해당 지역 플레이어끼리만
export function useGameRank(game: GameKind = 'tetris', days = 7, region?: string | null) {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['game-rank', game, days, region ?? 'all', user?.id ?? 'anon'],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<GameRankRow[]> => {
      const { data, error } = await supabase.rpc('game_rank', {
        p_game: game,
        p_days: days,
        p_region: region ?? null,
      })
      if (error) throw error
      return (data ?? []) as GameRankRow[]
    },
  })
}

export function useGameBadges() {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ['game-badges', user?.id ?? 'anon'],
    enabled: !!user && !user.isGuest,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<GameBadges | null> => {
      const { data, error } = await supabase.rpc('game_badges')
      if (error) throw error
      return (data ?? null) as GameBadges | null
    },
  })
}

// 점수 기록 — 게스트는 계정이 없어 저장하지 않는다(랭킹은 계정 단위)
export function useSubmitScore() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const region = useOnboardingStore((s) => s.region)
  return useMutation({
    mutationFn: async ({ game, score }: { game: GameKind; score: number }) => {
      if (!user || user.isGuest) return null
      // user_id 는 RLS(current_user_id)가 검증하므로 앱 uid 를 직접 넣지 않고 RPC 없이 insert
      const { data: me } = await supabase.rpc('current_user_id')
      if (!me) return null
      const { error } = await supabase
        .from('game_scores')
        .insert({ user_id: me, game, score, region: region ?? null })
      if (error) throw error
      return true
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['game-rank'] })
      qc.invalidateQueries({ queryKey: ['game-badges'] })
    },
  })
}
