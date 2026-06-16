import { useEffect } from 'react'

import { toAuthUser } from '@/features/auth/mapper'
import { useAuthStore } from '@/features/auth/store'
import { supabase } from '@/lib/supabase'

// Supabase Auth 세션 구독 — 세션 변화 시 Zustand 스토어 동기화
export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    // 초기 세션 로드
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session ? toAuthUser(data.session.user) : null)
    })

    // 세션 변화 구독 (로그인/로그아웃/토큰 갱신)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? toAuthUser(session.user) : null)
    })

    return () => subscription.unsubscribe()
  }, [setUser, setLoading])

  return { user, isAuthenticated, isLoading }
}
