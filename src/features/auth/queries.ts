import { useMutation } from '@tanstack/react-query'
import { createURL } from 'expo-linking'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from './store'
import { toAuthUser } from './mapper'
import type { LoginFormData, PhoneFormData, RegisterFormData } from './types'

// OAuth 콜백 redirect URI (expo-linking — expo-crypto 의존 없음)
const redirectTo = createURL('auth-callback')

// 이메일 로그인
export function useSignIn() {
  const setUser = useAuthStore((state) => state.setUser)
  return useMutation({
    mutationFn: async ({ email, password }: LoginFormData) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return data.user
    },
    onSuccess: (user) => {
      if (user) setUser(toAuthUser(user))
      router.replace('/(tabs)' as never)
    },
  })
}

// 이메일 회원가입
export function useSignUp() {
  const setUser = useAuthStore((state) => state.setUser)
  return useMutation({
    mutationFn: async ({ email, password, fullName }: RegisterFormData) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) throw error
      return data.user
    },
    onSuccess: (user) => {
      if (user) setUser(toAuthUser(user))
      router.replace('/(tabs)' as never)
    },
  })
}

// Guest(익명) 로그인 — 가입 없이 핵심 기능 사용 (PLANNING §6)
export function useSignInAnonymous() {
  const setUser = useAuthStore((state) => state.setUser)
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      return data.user
    },
    onSuccess: (user) => {
      if (user) setUser(toAuthUser(user))
      router.replace('/(tabs)' as never)
    },
  })
}

// 소셜 로그인 (Google / Apple) — OAuth, Supabase 대시보드에 provider 설정 필요
export function useOAuthSignIn() {
  return useMutation({
    mutationFn: async (provider: 'google' | 'apple') => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      })
      if (error) throw error
      if (!data.url) throw new Error('OAuth URL 생성 실패')

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
      if (result.type !== 'success') throw new Error('로그인이 취소되었습니다')

      const url = new URL(result.url)
      const params = new URLSearchParams(url.hash.replace(/^#/, ''))
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (!access_token || !refresh_token) throw new Error('세션 토큰을 받지 못했습니다')

      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })
      if (sessionError) throw sessionError
    },
    onSuccess: () => router.replace('/(tabs)' as never),
  })
}

// 전화 OTP 발송 (NHN Cloud SMS provider 설정 필요)
export function useSendOtp() {
  return useMutation({
    mutationFn: async ({ phone }: PhoneFormData) => {
      const { error } = await supabase.auth.signInWithOtp({ phone })
      if (error) throw error
    },
  })
}

// 전화 OTP 검증
export function useVerifyOtp() {
  const setUser = useAuthStore((state) => state.setUser)
  return useMutation({
    mutationFn: async ({ phone, token }: { phone: string; token: string }) => {
      const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
      if (error) throw error
      return data.user
    },
    onSuccess: (user) => {
      if (user) setUser(toAuthUser(user))
      router.replace('/(tabs)' as never)
    },
  })
}

// 로그아웃
export function useSignOut() {
  const clearAuth = useAuthStore((state) => state.signOut)
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      clearAuth()
      router.replace('/(auth)/landing')
    },
  })
}
