// Guest 로그인 유도 (BACKLOG #8) — 쿠폰/AI 대화 저장 등 계정 귀속이 필요한 동작을
// Guest가 시도하면 로그인 시트를 띄운다. 로그인 성공 시 보류된 동작을 이어서 실행한다.
import { create } from 'zustand'
import { useAuthStore } from './store'

type LoginPromptState = {
  visible: boolean
  // 시트에 표시할 사유 문구 i18n 키 (예: 'auth.gateCoupon')
  reasonKey: string
  // 로그인 성공 후 이어서 실행할 보류 동작
  pending: (() => void) | null
  show: (reasonKey: string, pending?: (() => void) | null) => void
  hide: () => void
  // 로그인 성공 시 호출 — 보류 동작을 1회 실행하고 시트를 닫는다
  resolve: () => void
}

export const useLoginPrompt = create<LoginPromptState>((set, get) => ({
  visible: false,
  reasonKey: 'auth.gateCoupon',
  pending: null,
  show: (reasonKey, pending = null) => set({ visible: true, reasonKey, pending }),
  hide: () => set({ visible: false, pending: null }),
  resolve: () => {
    const { pending } = get()
    set({ visible: false, pending: null })
    pending?.()
  },
}))

// 계정 귀속 동작 게이트 — 인증 유저는 즉시 실행, Guest/미인증은 로그인 시트 노출
export function useRequireAccount() {
  const show = useLoginPrompt((s) => s.show)
  return (reasonKey: string, action: () => void) => {
    const user = useAuthStore.getState().user
    if (user && !user.isGuest) {
      action()
      return
    }
    show(reasonKey, action)
  }
}
