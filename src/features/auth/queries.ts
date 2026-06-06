import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './store'
import type { LoginFormData, RegisterFormData } from './types'

function toAuthUser(user: NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']>) {
  return {
    id: user.id,
    email: user.email!,
    fullName: (user.user_metadata?.['full_name'] as string) ?? null,
    avatarUrl: (user.user_metadata?.['avatar_url'] as string) ?? null,
    createdAt: user.created_at,
  }
}

export function useSignIn() {
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: async ({ email, password }: LoginFormData) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      if (data.user) {
        setUser(toAuthUser(data.user))
        router.replace('/(tabs)/')
      }
    },
  })
}

export function useSignUp() {
  return useMutation({
    mutationFn: async ({ email, password, fullName }: RegisterFormData) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      router.replace('/(auth)/login')
    },
  })
}

export function useSignOut() {
  const signOut = useAuthStore((state) => state.signOut)

  return useMutation({
    mutationFn: () => supabase.auth.signOut(),
    onSuccess: () => {
      signOut()
      router.replace('/(auth)/login')
    },
  })
}
