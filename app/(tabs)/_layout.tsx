import { Redirect, Tabs } from 'expo-router'
import { Bot, Home, Map, Tag, User, type LucideIcon } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { useAuth } from '@/hooks/useAuth'
import { useT } from '@/lib/i18n'

const ACTIVE = '#0EA5E9'
const INACTIVE = '#A1A1AA'
const ROUTE_ICON: Record<string, LucideIcon> = {
  index: Home,
  map: Map,
  ai: Bot,
  coupons: Tag,
  profile: User,
}

// 탭바 props 중 사용하는 필드만 (의존 패키지 타입 미노출 회피)
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] }
  navigation: { navigate: (name: string) => void }
}

// 메인 탭 버튼 — 활성/비활성 모두 아이콘 + 라벨 표시(활성은 강조색)
function MainTab({
  name,
  label,
  focused,
  onPress,
}: {
  name: string
  label: string
  focused: boolean
  onPress: () => void
}) {
  const color = focused ? ACTIVE : INACTIVE
  const LucideCmp = ROUTE_ICON[name]
  return (
    <Pressable
      style={ss.item}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}>
      <View style={ss.iconSlot}>{LucideCmp ? <LucideCmp size={22} color={color} /> : null}</View>
      <Text style={[ss.label, { color, fontWeight: focused ? '800' : '600' }]}>{label}</Text>
    </Pressable>
  )
}

// 커스텀 하단 탭바 — 통역 탭(탭 화면으로 전환, 탭바 유지) + 통역 아이콘 한A 글리프
function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets()
  const t = useT()
  const activeName = state.routes[state.index]?.name
  const translateFocused = activeName === 'translate'

  return (
    <View style={[ss.bar, { height: 56 + insets.bottom, paddingBottom: insets.bottom + 8 }]}>
      <MainTab
        name="index"
        label={t('tab.home')}
        focused={activeName === 'index'}
        onPress={() => navigation.navigate('index')}
      />
      <MainTab
        name="map"
        label={t('tab.map')}
        focused={activeName === 'map'}
        onPress={() => navigation.navigate('map')}
      />
      {/* 통역 — 탭 화면으로 이동(탭바 유지) + 한A 아이콘, 활성 시 강조 */}
      <Pressable
        style={ss.item}
        onPress={() => navigation.navigate('translate')}
        accessibilityRole="button"
        accessibilityState={{ selected: translateFocused }}>
        <View style={ss.iconSlot}>
          <Icon name="translate" size={22} color={translateFocused ? ACTIVE : INACTIVE} />
        </View>
        <Text
          style={[
            ss.label,
            {
              color: translateFocused ? ACTIVE : INACTIVE,
              fontWeight: translateFocused ? '800' : '600',
            },
          ]}>
          {t('tab.translate')}
        </Text>
      </Pressable>
      <MainTab
        name="ai"
        label={t('tab.ai')}
        focused={activeName === 'ai'}
        onPress={() => navigation.navigate('ai')}
      />
      <MainTab
        name="coupons"
        label={t('tab.coupons')}
        focused={activeName === 'coupons'}
        onPress={() => navigation.navigate('coupons')}
      />
      <MainTab
        name="profile"
        label={t('tab.my')}
        focused={activeName === 'profile'}
        onPress={() => navigation.navigate('profile')}
      />
    </View>
  )
}

export default function TabsLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/landing" />
  }

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar state={props.state} navigation={props.navigation} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="translate" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="coupons" />
      <Tabs.Screen name="profile" />
      {/* 기존 탭 — 하단 네비에서 숨김 */}
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="trips" options={{ href: null }} />
    </Tabs>
  )
}

const ss = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E4E4E7',
    borderTopWidth: 0.5,
    paddingTop: 6,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 3 },
  // 아이콘 자리 고정(숨겨도 라벨 위치 유지)
  iconSlot: { height: 24, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10 },
})
