// 여행자 피드 상호작용 상태 — 좋아요(별)/내 댓글. MMKV persist(오프라인 유지).
// 포스트는 결정론적 id를 가지므로 재실행 후에도 내 좋아요·댓글이 그대로 복원된다.
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { zustandStorage } from '@/lib/mmkv'
import { pruneSyncedLocal } from './comments'

export type MyComment = {
  id: string
  text: string
  ts: number // epoch ms
  replies?: MyComment[] // 대댓글(1단계)
  // 게스트가 서버 댓글에 남긴 답글 — 서버에 저장할 계정이 없어 로컬 루트로 보관하되
  // 누구에게 답한 것인지는 잃지 않도록 상대 이름을 들고 있는다
  replyToName?: string
}

interface FeedState {
  liked: Record<string, boolean> // postId → 좋아요 여부
  comments: Record<string, MyComment[]> // postId → 내 댓글 목록
  blocked: Record<string, boolean> // 차단한 작성자 (REQ-UGC-3)
  hidden: Record<string, boolean> // 신고 후 가린 게시물
  // 내가 댓글을 단 게시물 — 본문은 서버에 있고 로컬에 남지 않으므로(중복 방지),
  // 카드의 "댓글 남김" 표시만 별도로 기억한다
  commentedPosts: Record<string, boolean>
  toggleLike: (postId: string) => void
  addComment: (postId: string, text: string, id?: string, replyToName?: string) => void
  addReply: (postId: string, commentId: string, text: string) => void
  // 서버가 받아간 로컬 복사본 제거 — 같은 댓글이 "나"와 "내 이름"으로 두 번 보이던 원인
  removeComment: (postId: string, id: string) => void
  markCommented: (postId: string) => void
  // 서버에 이미 같은 본문이 올라간 로컬 댓글 정리(이전 버전에서 중복 저장된 기기 자가 복구)
  pruneSynced: (postId: string, synced: { body: string; ts: number }[]) => void
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
      commentedPosts: {},
      toggleLike: (postId) => set((s) => ({ liked: { ...s.liked, [postId]: !s.liked[postId] } })),
      addComment: (postId, text, id, replyToName) =>
        set((s) => {
          const body = text.trim()
          if (!body) return s
          const c: MyComment = {
            id: id ?? `${postId}:${(s.comments[postId]?.length ?? 0) + 1}`,
            text: body,
            ts: Date.now(),
            ...(replyToName ? { replyToName } : {}),
          }
          return { comments: { ...s.comments, [postId]: [...(s.comments[postId] ?? []), c] } }
        }),
      markCommented: (postId) =>
        set((s) => ({ commentedPosts: { ...s.commentedPosts, [postId]: true } })),
      removeComment: (postId, id) =>
        set((s) => ({
          comments: {
            ...s.comments,
            [postId]: (s.comments[postId] ?? []).filter((c) => c.id !== id),
          },
        })),
      pruneSynced: (postId, synced) =>
        set((s) => {
          const list = s.comments[postId] ?? []
          const next = pruneSyncedLocal(list, synced)
          if (next.length === list.length) return s
          return { comments: { ...s.comments, [postId]: next } }
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
