import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { zustandStorage } from '@/lib/mmkv'
import type { AuthUser } from './types'

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      // 내용이 같으면 기존 상태 유지 — 토큰 갱신(TOKEN_REFRESHED)마다 같은 값의 새 객체가
      // 들어와 루트 구독자(useAuth)가 불필요하게 리렌더되는 것을 막는다
      setUser: (user) =>
        set((s) => {
          const same =
            !s.isLoading &&
            (s.user === user ||
              (!!s.user && !!user && JSON.stringify(s.user) === JSON.stringify(user)))
          return same ? s : { user, isAuthenticated: !!user, isLoading: false }
        }),
      setLoading: (isLoading) => set({ isLoading }),
      signOut: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({ user: state.user }),
    },
  ),
)
