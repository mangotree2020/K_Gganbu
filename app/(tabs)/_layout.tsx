import { Redirect, Tabs } from 'expo-router'
import { Bot, Home, Map, Tag, User } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/lib/i18n'

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth()
  const insets = useSafeAreaInsets()
  const t = useT()

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/landing" />
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0EA5E9',
        tabBarInactiveTintColor: '#A1A1AA',
        headerShown: false,
        tabBarStyle: {
          borderTopColor: '#E4E4E7',
          borderTopWidth: 0.5,
          backgroundColor: '#FFFFFF',
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab.home'),
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t('tab.map'),
          tabBarIcon: ({ color, size }) => <Map size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: t('tab.ai'),
          tabBarIcon: ({ color, size }) => <Bot size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="coupons"
        options={{
          title: t('tab.coupons'),
          tabBarIcon: ({ color, size }) => <Tag size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tab.my'),
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      {/* 기존 탭 — 하단 네비에서 숨김 */}
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="trips" options={{ href: null }} />
    </Tabs>
  )
}
