import { useEffect } from 'react'

import { toAuthUser } from '@/features/auth/mapper'
import { useAuthStore } from '@/features/auth/store'
import { flushRemoteQueue } from '@/features/translate/history'
import { flushSync } from '@/lib/remoteSync'
import { supabase } from '@/lib/supabase'

// Supabase Auth 세션 구독 — 세션 변화 시 Zustand 스토어 동기화
export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    // 초기 세션 로드 — 세션 준비되면 미전송 통역 이력 재시도(앱 시작 시 업로드)
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session ? toAuthUser(data.session.user) : null)
      if (data.session) {
        flushRemoteQueue()
        flushSync()
      }
    })

    // 세션 변화 구독 (로그인/로그아웃/토큰 갱신). 로그인/익명 세션 확보 시 대기열 재시도.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? toAuthUser(session.user) : null)
      if (session) {
        flushRemoteQueue()
        flushSync()
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser, setLoading])

  return { user, isAuthenticated, isLoading }
}
