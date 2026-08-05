// 댓글 시트 열림 상태 — 화면(피드 카드)과 시트(루트 오버레이)가 서로 다른 트리에 있어
// 상태를 밖으로 뺀다. Modal 대신 루트 오버레이를 쓰는 이유는 CommentSheet 주석 참조.
import { create } from 'zustand'

interface CommentSheetState {
  postId: string | null
  open: (postId: string) => void
  close: () => void
}

export const useCommentSheet = create<CommentSheetState>((set) => ({
  postId: null,
  open: (postId) => set({ postId }),
  close: () => set({ postId: null }),
}))
