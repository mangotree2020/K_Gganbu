import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/features/auth/store'

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    // 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          fullName: (session.user.user_metadata?.['full_name'] as string) ?? null,
          avatarUrl: (session.user.user_metadata?.['avatar_url'] as string) ?? null,
          createdAt: session.user.created_at,
        })
      } else {
        setLoading(false)
      }
    })

    // 인증 상태 변화 구독
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          fullName: (session.user.user_metadata?.['full_name'] as string) ?? null,
          avatarUrl: (session.user.user_metadata?.['avatar_url'] as string) ?? null,
          createdAt: session.user.created_at,
        })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser, setLoading])

  return { user, isAuthenticated, isLoading }
}
