// 푸시 알림 opt-in 상태 (PLANNING §11) — MMKV persist. 실 FCM 미설정이어도 선호는 유지.
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { zustandStorage } from '@/lib/mmkv'

interface PushState {
  enabled: boolean
  setEnabled: (v: boolean) => void
}

export const usePushStore = create<PushState>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled }),
    }),
    {
      name: 'push-optin',
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
)
