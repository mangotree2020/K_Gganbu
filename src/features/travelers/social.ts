// 피드 좋아요·댓글 서버 동기화 (PRD REQ-UGC-2)
// 로컬(MMKV store)이 즉시 반응을 담당하고, 여기서는 서버에 남겨 기기 간 동기화·타인 노출을 처리한다.
// 게스트는 계정이 없어 서버 저장을 건너뛴다 — 로컬만으로도 화면은 동일하게 동작한다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/store'
import { supabase } from '@/lib/supabase'

export type FeedCount = {
  post_id: string
  likes: number
  comments: number
  liked_by_me: boolean
}

export type FeedComment = {
  id: string
  postId: string
  author: string
  parentId: string | null
  body: string
  createdAt: string
}

async function myId(): Promise<string | null> {
  const { data } = await supabase.rpc('current_user_id')
  return (data as string | null) ?? null
}

// 화면에 보이는 포스트들의 좋아요·댓글 수를 한 번에 — 카드마다 쿼리하면 스크롤 중 요청이 폭증한다
export function useFeedCounts(postIds: string[]) {
  const key = postIds.join(',')
  return useQuery({
    queryKey: ['feed-counts', key],
    enabled: postIds.length > 0,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<Record<string, FeedCount>> => {
      const { data, error } = await supabase.rpc('feed_counts', { p_post_ids: postIds })
      if (error) throw error
      const out: Record<string, FeedCount> = {}
      for (const row of (data ?? []) as FeedCount[]) out[row.post_id] = row
      return out
    },
  })
}

export function usePostComments(postId: string | null) {
  return useQuery({
    queryKey: ['feed-comments', postId],
    enabled: !!postId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<FeedComment[]> => {
      const { data, error } = await supabase
        .from('feed_comments')
        .select('id, post_id, author_name, parent_id, body, created_at')
        .eq('post_id', postId!)
        .order('created_at', { ascending: true })
        .limit(100)
      if (error) throw error
      return (data ?? []).map((c: CommentRow) => ({
        id: c.id,
        postId: c.post_id,
        author: c.author_name,
        parentId: c.parent_id,
        body: c.body,
        createdAt: c.created_at,
      }))
    },
  })
}

type CommentRow = {
  id: string
  post_id: string
  author_name: string
  parent_id: string | null
  body: string
  created_at: string
}

export function useToggleLikeRemote() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: async ({ postId, liked }: { postId: string; liked: boolean }) => {
      if (!user || user.isGuest) return null
      const me = await myId()
      if (!me) return null
      if (liked) {
        await supabase
          .from('feed_likes')
          .upsert({ user_id: me, post_id: postId }, { onConflict: 'user_id,post_id' })
      } else {
        await supabase.from('feed_likes').delete().eq('user_id', me).eq('post_id', postId)
      }
      return true
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed-counts'] }),
  })
}

export function useAddCommentRemote() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: async (input: {
      postId: string
      body: string
      authorName: string
      parentId?: string | null
    }) => {
      if (!user || user.isGuest) return null
      const me = await myId()
      if (!me) return null
      const { error } = await supabase.from('feed_comments').insert({
        post_id: input.postId,
        user_id: me,
        author_name: input.authorName,
        parent_id: input.parentId ?? null,
        body: input.body.trim(),
      })
      if (error) throw error
      return true
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['feed-comments', v.postId] })
      qc.invalidateQueries({ queryKey: ['feed-counts'] })
    },
  })
}
