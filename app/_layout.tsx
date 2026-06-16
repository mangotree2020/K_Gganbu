import '../global.css'

import { Stack, router } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { LogBox } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@/lib/queryClient'
import { useAuth } from '@/hooks/useAuth'

LogBox.ignoreAllLogs()
SplashScreen.preventAutoHideAsync()

export { ErrorBoundary } from 'expo-router'

export const unstable_settings = {
  initialRouteName: '(auth)',
}

export default function RootLayout() {
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

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync()
    }
  }, [isLoading])

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace('/(auth)/landing')
    }
  }, [isAuthenticated, isLoading])

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="translate" options={{ presentation: 'modal' }} />
        <Stack.Screen name="emergency" options={{ presentation: 'modal' }} />
        <Stack.Screen name="place" options={{ presentation: 'modal' }} />
        <Stack.Screen name="cruise" options={{ presentation: 'modal' }} />
        <Stack.Screen name="tips" options={{ presentation: 'modal' }} />
        <Stack.Screen name="allergy" options={{ presentation: 'modal' }} />
        <Stack.Screen name="coupon-qr" options={{ presentation: 'modal' }} />
        <Stack.Screen name="voice-interpret" options={{ presentation: 'modal' }} />
        <Stack.Screen name="phrases" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  )
}
