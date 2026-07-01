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

// LINE 로그인 (커스텀) — Supabase는 LINE 네이티브 미지원이라 직접 구현:
// 앱이 LINE OAuth로 code 획득 → line-auth Edge Function이 검증·세션토큰 발급 →
// verifyOtp(token_hash)로 세션 확립. 채널 ID(공개)는 EXPO_PUBLIC, 시크릿은 서버.
const LINE_CHANNEL_ID = process.env.EXPO_PUBLIC_LINE_CHANNEL_ID
export const LINE_ENABLED = !!LINE_CHANNEL_ID
// LINE은 redirect_uri로 커스텀 스킴을 불허(https만) → https 중계 함수(line-callback)를
// redirect_uri로 쓰고, 그 함수가 앱 스킴(travel-app://auth-callback)으로 302 바운스한다.
// 토큰교환도 동일 redirect_uri여야 하므로 line-auth에 이 https URL을 넘긴다.
const LINE_REDIRECT = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/line-callback`

export function useLINESignIn() {
  const setUser = useAuthStore((state) => state.setUser)
  return useMutation({
    mutationFn: async () => {
      if (!LINE_CHANNEL_ID) throw new Error('LINE 로그인이 아직 설정되지 않았습니다')
      // CSRF 방지용 state(난수). LINE은 redirect_uri가 채널 Callback URL과 정확히 일치해야 함.
      const state = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
      const authUrl =
        'https://access.line.me/oauth2/v2.1/authorize?response_type=code' +
        `&client_id=${LINE_CHANNEL_ID}` +
        `&redirect_uri=${encodeURIComponent(LINE_REDIRECT)}` +
        `&state=${state}` +
        `&scope=${encodeURIComponent('openid profile')}`

      // authorize는 https 중계로 가지만, 브라우저 세션은 앱 스킴 착지 시 종료
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo)
      if (result.type !== 'success') throw new Error('로그인이 취소되었습니다')

      const url = new URL(result.url)
      const code = url.searchParams.get('code')
      if (!code) {
        const reason = url.searchParams.get('error_description') ?? url.searchParams.get('error')
        throw new Error(reason ? `LINE 오류: ${reason}` : 'LINE 인가 코드를 받지 못했습니다')
      }
      if (url.searchParams.get('state') !== state) throw new Error('상태 검증 실패(보안)')

      // Edge Function: code 검증 → magiclink 토큰 (토큰교환 redirect_uri는 authorize와 동일해야 함)
      const { data, error } = await supabase.functions.invoke('line-auth', {
        body: { code, redirectUri: LINE_REDIRECT },
      })
      if (error) throw error
      if (!data?.tokenHash) throw new Error(data?.message ?? 'LINE 로그인에 실패했습니다')

      // 토큰으로 세션 확립
      const { data: sess, error: vErr } = await supabase.auth.verifyOtp({
        token_hash: data.tokenHash,
        type: 'magiclink',
      })
      if (vErr) throw vErr
      return sess.user
    },
    onSuccess: (user) => {
      if (user) setUser(toAuthUser(user))
      router.replace('/(tabs)' as never)
    },
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
