// 여행자 피드 상호작용 상태 — 좋아요(별)/내 댓글. MMKV persist(오프라인 유지).
// 포스트는 결정론적 id를 가지므로 재실행 후에도 내 좋아요·댓글이 그대로 복원된다.
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { zustandStorage } from '@/lib/mmkv'

export type MyComment = {
  id: string
  text: string
  ts: number // epoch ms
  replies?: MyComment[] // 대댓글(1단계)
}

interface FeedState {
  liked: Record<string, boolean> // postId → 좋아요 여부
  comments: Record<string, MyComment[]> // postId → 내 댓글 목록
  toggleLike: (postId: string) => void
  addComment: (postId: string, text: string) => void
  addReply: (postId: string, commentId: string, text: string) => void
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
      liked: {},
      comments: {},
      toggleLike: (postId) => set((s) => ({ liked: { ...s.liked, [postId]: !s.liked[postId] } })),
      addComment: (postId, text) =>
        set((s) => {
          const body = text.trim()
          if (!body) return s
          const c: MyComment = {
            id: `${postId}:${(s.comments[postId]?.length ?? 0) + 1}`,
            text: body,
            ts: Date.now(),
          }
          return { comments: { ...s.comments, [postId]: [...(s.comments[postId] ?? []), c] } }
        }),
      addReply: (postId, commentId, text) =>
        set((s) => {
          const body = text.trim()
          if (!body) return s
          const list = s.comments[postId] ?? []
          const next = list.map((c) => {
            if (c.id !== commentId) return c
            const reply: MyComment = {
              id: `${commentId}:r${(c.replies?.length ?? 0) + 1}`,
              text: body,
              ts: Date.now(),
            }
            return { ...c, replies: [...(c.replies ?? []), reply] }
          })
          return { comments: { ...s.comments, [postId]: next } }
        }),
    }),
    {
      name: 'traveler-feed-store',
      storage: createJSONStorage(() => zustandStorage),
      version: 1,
    },
  ),
)
