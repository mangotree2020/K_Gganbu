// 즐겨찾기 — favorites 테이블 CRUD (PLANNING §20, BACKLOG #20)
// 외부 POI(TourAPI/Naver)를 place_ext_id + 표시정보로 비정규화 저장. RLS: 본인 데이터만.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// 즐겨찾기 대상 POI (앱 Poi에서 추출)
export type FavPoi = {
  extId: string
  name: string
  address?: string | null
  lat?: number | null
  lng?: number | null
  imageUrl?: string | null
  cat?: string | null
}

export type FavoriteRow = {
  id: string
  place_ext_id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  image_url: string | null
  cat: string | null
  created_at: string
}

// 현재 사용자(로그인/Guest)의 public.users.id 해석 (favorites.user_id, RLS용)
async function myUserId(): Promise<string | null> {
  const { data, error } = await supabase.from('users').select('id').single()
  if (error) return null
  return (data?.id as string) ?? null
}

export function useFavorites() {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: async (): Promise<FavoriteRow[]> => {
      const { data, error } = await supabase
        .from('favorites')
        .select('id, place_ext_id, name, address, lat, lng, image_url, cat, created_at')
        .eq('type', 'place')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as FavoriteRow[]
    },
  })
}

// 토글: 있으면 삭제, 없으면 추가. 반환값 = 토글 후 즐겨찾기 여부
export function useToggleFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (poi: FavPoi): Promise<boolean> => {
      const uid = await myUserId()
      if (!uid) throw new Error('not_authenticated')

      const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('place_ext_id', poi.extId)
        .eq('type', 'place')
        .maybeSingle()

      if (existing?.id) {
        const { error } = await supabase.from('favorites').delete().eq('id', existing.id)
        if (error) throw error
        return false
      }

      const { error } = await supabase.from('favorites').insert({
        user_id: uid,
        place_ext_id: poi.extId,
        name: poi.name,
        address: poi.address ?? null,
        lat: poi.lat ?? null,
        lng: poi.lng ?? null,
        image_url: poi.imageUrl ?? null,
        cat: poi.cat ?? null,
        type: 'place',
      })
      if (error) throw error
      return true
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  })
}
