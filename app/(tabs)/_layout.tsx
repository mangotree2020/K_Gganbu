import { Redirect, Tabs } from 'expo-router'
import { Compass, Home, Map, User } from 'lucide-react-native'

import { useAuth } from '@/hooks/useAuth'

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  if (!isLoading && !isAuthenticated) {
    return <Redirect href='/(auth)/login' />
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',
        headerShown: false,
        tabBarStyle: {
          borderTopColor: '#E2E8F0',
        },
      }}>
      <Tabs.Screen
        name='index'
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name='explore'
        options={{
          title: '탐색',
          tabBarIcon: ({ color, size }) => <Compass size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name='trips'
        options={{
          title: '내 여행',
          tabBarIcon: ({ color, size }) => <Map size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name='profile'
        options={{
          title: '프로필',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
