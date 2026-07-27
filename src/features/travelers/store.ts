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
  blocked: Record<string, boolean> // 차단한 작성자 (REQ-UGC-3)
  hidden: Record<string, boolean> // 신고 후 가린 게시물
  toggleLike: (postId: string) => void
  addComment: (postId: string, text: string) => void
  addReply: (postId: string, commentId: string, text: string) => void
  blockAuthor: (author: string) => void
  unblockAuthor: (author: string) => void
  hidePost: (postId: string) => void
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
      liked: {},
      comments: {},
      blocked: {},
      hidden: {},
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
      // 차단·숨김 (REQ-UGC-3) — 사용자가 "안 보이게" 한 것은 서버 왕복을 기다리지 않고 즉시 반영한다
      blockAuthor: (author) => set((s) => ({ blocked: { ...s.blocked, [author]: true } })),
      unblockAuthor: (author) =>
        set((s) => {
          const next = { ...s.blocked }
          delete next[author]
          return { blocked: next }
        }),
      hidePost: (postId) => set((s) => ({ hidden: { ...s.hidden, [postId]: true } })),
    }),
    {
      name: 'traveler-feed-store',
      storage: createJSONStorage(() => zustandStorage),
      version: 1,
    },
  ),
)
