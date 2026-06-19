import { useMutation } from '@tanstack/react-query'
import { createURL } from 'expo-linking'
import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from './store'
import { toAuthUser } from './mapper'
import { parseAuthCallback } from './callback'
import type { LoginFormData, PhoneFormData, RegisterFormData } from './types'

// OAuth 콜백 redirect URI (expo-linking — expo-crypto 의존 없음)
const redirectTo = createURL('auth-callback')

// 현재 세션이 Guest(익명)인지 확인 — 익명이면 신규 로그인이 아닌 "승격"으로 처리해
// 동일 user_id를 유지하고 즐겨찾기·쿠폰 등 Guest 데이터를 그대로 승계한다 (BACKLOG #7)
async function isAnonymousSession() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.is_anonymous ?? false
}

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
      // Guest면 linkIdentity로 익명 세션에 소셜 ID 연결(승격, 동일 user_id 유지).
      // manual linking 비활성 등으로 실패하면 신규 OAuth 로그인으로 폴백 → 로그인은 항상 완료.
      const guest = await isAnonymousSession()
      const options = { redirectTo, skipBrowserRedirect: true }

      let linked = false
      let data: { url?: string | null } | null = null

      if (guest) {
        const link = await supabase.auth.linkIdentity({ provider, options })
        if (!link.error && link.data?.url) {
          data = link.data
          linked = true
        } else {
          // 승격 불가 → 신규 로그인 폴백(Guest 데이터 승계는 불가)
          const fresh = await supabase.auth.signInWithOAuth({ provider, options })
          if (fresh.error) throw fresh.error
          data = fresh.data
        }
      } else {
        const fresh = await supabase.auth.signInWithOAuth({ provider, options })
        if (fresh.error) throw fresh.error
        data = fresh.data
      }

      if (!data?.url) throw new Error('OAuth URL 생성 실패')

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
      if (result.type !== 'success') throw new Error('로그인이 취소되었습니다')

      if (linked) {
        // 익명 세션에 ID 연결 완료 → 세션 갱신으로 승격된(비-Guest) 유저 반영
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) throw refreshError
        return
      }

      // 신규 로그인 — 콜백 URL(hash/query)에서 토큰 추출 후 세션 설정
      const { access_token, refresh_token } = parseAuthCallback(result.url)
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
      // Guest면 updateUser로 전화번호를 익명 세션에 연결(승격). 실패(manual linking 비활성 등) 시
      // 신규 OTP 로그인으로 폴백 → 발송은 항상 완료.
      if (await isAnonymousSession()) {
        const { error } = await supabase.auth.updateUser({ phone })
        if (!error) return
      }
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
      // Guest는 승격(phone_change) 우선 검증, 실패 시 신규 로그인(sms)으로 폴백.
      // (발송이 updateUser/ signInWithOtp 중 무엇으로 됐든 검증이 완료되도록)
      const guest = await isAnonymousSession()
      let res = await supabase.auth.verifyOtp({
        phone,
        token,
        type: guest ? 'phone_change' : 'sms',
      })
      if (guest && res.error) {
        res = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
      }
      const { data, error } = res
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
