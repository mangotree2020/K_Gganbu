// 즐겨찾기 — favorites 테이블 CRUD (PLANNING §20, BACKLOG #20)
// 로컬 우선(local-first): 저장 버튼은 MMKV에 즉시 쓰고 UI를 바꾼 뒤, 서버 반영은 뒤에서 한다.
// 서버 왕복(사용자 id 조회 → 존재 확인 → insert → 목록 재조회)을 기다리던 지연을 제거한다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store'
import { supabase } from '@/lib/supabase'
import {
  enqueueFavOp,
  flushFavorites,
  readLocalFavorites,
  readQueue,
  writeLocalFavorites,
} from './local'
import { applyOps, dedupeRows, toggleRows } from './ops'
import type { FavoriteRow, FavPoi } from './types'

export type { FavPoi, FavoriteRow } from './types'

// 캐시 키에 계정을 포함한다. 전역 키 하나만 쓰면 로그아웃 후 다른 계정으로 들어왔을 때
// 이전 사용자의 목록이 그대로 보이고(initialData는 캐시가 있으면 적용되지 않는다),
// 그 목록을 기준으로 토글이 계산된다.
function useFavKey() {
  const authId = useAuthStore((s) => s.user?.id ?? null)
  return ['favorites', authId] as const
}

export function useFavorites() {
  const favKey = useFavKey()
  return useQuery({
    queryKey: favKey,
    // 로컬 캐시로 즉시 표시(콜드 스타트·오프라인). updatedAt 0 → 마운트 시 서버와 재동기화.
    initialData: readLocalFavorites,
    initialDataUpdatedAt: 0,
    queryFn: async (): Promise<FavoriteRow[]> => {
      await flushFavorites() // 미전송 로컬 변경을 먼저 올려 조회 결과와의 순서 역전을 막는다
      const { data, error } = await supabase
        .from('favorites')
        .select('id, place_ext_id, name, address, lat, lng, image_url, cat, created_at')
        .eq('type', 'place')
        .order('created_at', { ascending: false })
      if (error) throw error
      // 아직 못 올린 작업이 남아 있으면 서버 응답 위에 다시 얹는다(방금 저장한 항목 유실 방지)
      const merged = dedupeRows(applyOps((data ?? []) as FavoriteRow[], readQueue()))
      writeLocalFavorites(merged)
      return merged
    },
  })
}

// 토글: 있으면 삭제, 없으면 추가. 로컬 반영은 즉시, 서버 반영은 큐를 통해 비동기.
export function useToggleFavorite() {
  const qc = useQueryClient()
  const FAV_KEY = useFavKey()
  return useMutation({
    // onMutate는 동기 — 네트워크를 기다리지 않고 이 프레임에서 아이콘/목록이 바뀐다
    onMutate: (poi: FavPoi) => {
      // 진행 중인 조회가 낙관적 결과를 덮어쓰지 않도록 취소(대기하지 않음).
      // 취소가 늦어 응답이 도착해도 queryFn이 대기열을 재적용하므로 결과는 동일하다.
      void qc.cancelQueries({ queryKey: FAV_KEY })
      const prev = qc.getQueryData<FavoriteRow[]>(FAV_KEY) ?? readLocalFavorites()
      const at = Date.now()
      const { rows, added } = toggleRows(prev, poi, at)
      qc.setQueryData(FAV_KEY, rows)
      writeLocalFavorites(rows)
      enqueueFavOp({ op: added ? 'add' : 'remove', poi, at })
      return { added }
    },
    // 서버 반영 시도 — 실패해도 큐에 남아 다음 조회/토글 때 재시도되므로 롤백하지 않는다
    mutationFn: async (_poi: FavPoi): Promise<void> => {
      await flushFavorites()
    },
  })
}
