import '../global.css'

import { LogBox } from 'react-native'
import { QueryClientProvider } from '@tanstack/react-query'

LogBox.ignoreAllLogs()

export const unstable_settings = {
  initialRouteName: '(auth)',
}

import { Stack, router } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { queryClient } from '@/lib/queryClient'
import { useAuth } from '@/hooks/useAuth'

SplashScreen.preventAutoHideAsync()

export { ErrorBoundary } from 'expo-router'

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
      router.replace('/(auth)/login')
    }
  }, [isAuthenticated, isLoading])

  return (
    <>
      <StatusBar style='auto' />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name='(auth)' />
        <Stack.Screen name='(tabs)' />
      </Stack>
    </>
  )
}
