import '../global.css'

import { Stack, router, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { LogBox } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@/lib/queryClient'
import { useAuth } from '@/hooks/useAuth'
import { useOnboardingStore } from '@/features/onboarding/store'
import { LoginPromptSheet } from '@/features/auth/LoginPromptSheet'
import { setupNotificationDisplay } from '@/features/notifications/services'

LogBox.ignoreAllLogs()
SplashScreen.preventAutoHideAsync()

export { ErrorBoundary } from 'expo-router'

export const unstable_settings = {
  initialRouteName: '(auth)',
}

export default function RootLayout() {
  // 알림 채널·포그라운드 표시 셋업 (1회, 미포함 빌드는 내부에서 무시)
  useEffect(() => {
    setupNotificationDisplay()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootLayoutNav />
      </GestureHandlerRootView>
    </QueryClientProvider>
  )
}

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth()
  const onboardingDone = useOnboardingStore((s) => s.completed)
  const segments = useSegments()

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync()
    }
  }, [isLoading])

  // 인증·온보딩 상태에 따른 권위적 라우팅 가드(expo-router segments 기반).
  // 인증+온보딩 완료인데 아직 (auth)/(onboarding) 그룹에 있으면 본화면으로 보낸다 —
  // OAuth 콜백 딥링크가 네비를 (auth)로 리셋해도 가드가 즉시 (tabs)로 복귀시킨다.
  useEffect(() => {
    if (isLoading) return
    const group = segments[0]
    const inAuth = group === '(auth)'
    const inOnboarding = group === '(onboarding)'
    if (!isAuthenticated) {
      if (!inAuth) router.replace('/(auth)/landing')
    } else if (!onboardingDone) {
      // 인증됐지만 온보딩 미완료 → 언어 선택부터
      if (!inOnboarding) router.replace('/(onboarding)/language')
    } else if (inAuth || inOnboarding) {
      // 인증·온보딩 완료인데 인증/온보딩 화면에 머물러 있으면 앱 본화면으로
      router.replace('/(tabs)')
    }
  }, [isAuthenticated, isLoading, onboardingDone, segments])

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        {/* OAuth 콜백 딥링크 착지 — 404 대신 로딩 표시(gesture/animation 없이 즉시 처리) */}
        <Stack.Screen name="auth-callback" options={{ gestureEnabled: false, animation: 'none' }} />
        <Stack.Screen name="(tabs)" />
        {/* translate는 (tabs)/translate 탭 화면으로 이동 — 탭바 유지(PLANNING §19) */}
        <Stack.Screen name="emergency" options={{ presentation: 'modal' }} />
        <Stack.Screen name="place" options={{ presentation: 'modal' }} />
        <Stack.Screen name="passport" options={{ presentation: 'modal' }} />
        <Stack.Screen name="tax-free" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profile-edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
        {/* cruise는 (tabs)/cruise 탭 화면으로 이동 — 크루즈 모드에서도 탭바 유지 */}
        <Stack.Screen name="tips" options={{ presentation: 'modal' }} />
        <Stack.Screen name="allergy" options={{ presentation: 'modal' }} />
        <Stack.Screen name="coupon-qr" options={{ presentation: 'modal' }} />
        {/* voice-interpret는 (tabs)/voice-interpret 탭 화면으로 이동 — 하단 네비게이션 바 유지 */}
        <Stack.Screen name="voice-history" options={{ presentation: 'modal' }} />
        <Stack.Screen name="phrases" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="rps-game" options={{ presentation: 'modal' }} />
        <Stack.Screen name="tetris" options={{ presentation: 'modal' }} />
        <Stack.Screen name="stamp-scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="favorites" options={{ presentation: 'modal' }} />
        <Stack.Screen name="wallet" options={{ presentation: 'modal' }} />
        <Stack.Screen name="itinerary" options={{ presentation: 'modal' }} />
        <Stack.Screen name="tickets" options={{ presentation: 'modal' }} />
        <Stack.Screen name="reviews" options={{ presentation: 'modal' }} />
      </Stack>
      <LoginPromptSheet />
    </>
  )
}
