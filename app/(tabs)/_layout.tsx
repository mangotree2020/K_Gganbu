import { Redirect, Tabs } from 'expo-router'
import { Bot, Home, Map, Tag, User, type LucideIcon } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { useAuth } from '@/hooks/useAuth'
import { useTabBarStore } from '@/hooks/useTabBarAutoHide'
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

// 커스텀 하단 탭바 — 통역 탭(탭 화면으로 전환, 탭바 유지) + 통역 아이콘 한A 글리프.
// X(트위터)식 자동 숨김: 스크롤 화면이 useTabBarAutoHide로 방향을 알려주면
// 높이를 0으로 접어 콘텐츠가 화면을 꽉 채우게 한다(아래로 플릭 시 복귀).
function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets()
  const t = useT()
  const activeName = state.routes[state.index]?.name
  const translateFocused = activeName === 'translate'
  const barH = 56 + insets.bottom

  const hidden = useTabBarStore((s) => s.hidden)
  const setHidden = useTabBarStore((s) => s.setHidden)
  const heightAnim = useState(() => new Animated.Value(barH))[0]
  useEffect(() => {
    // 높이 애니메이션은 레이아웃 속성이라 JS 드라이버 사용(200ms — 체감 즉시)
    Animated.timing(heightAnim, {
      toValue: hidden ? 0 : barH,
      duration: 200,
      useNativeDriver: false,
    }).start()
  }, [hidden, barH, heightAnim])
  // 탭 이동 시 항상 다시 표시(새 화면에서 네비 접근 보장)
  const go = (name: string) => {
    setHidden(false)
    navigation.navigate(name)
  }

  return (
    <Animated.View style={{ height: heightAnim, overflow: 'hidden' }}>
      <View style={[ss.bar, { height: barH, paddingBottom: insets.bottom + 8 }]}>
        <MainTab
          name="index"
          label={t('tab.home')}
          focused={activeName === 'index'}
          onPress={() => go('index')}
        />
        <MainTab
          name="map"
          label={t('tab.map')}
          focused={activeName === 'map'}
          onPress={() => go('map')}
        />
        {/* 통역 — 탭 화면으로 이동(탭바 유지) + 한A 아이콘, 활성 시 강조 */}
        <Pressable
          style={ss.item}
          onPress={() => go('translate')}
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
          onPress={() => go('ai')}
        />
        <MainTab
          name="coupons"
          label={t('tab.coupons')}
          focused={activeName === 'coupons'}
          onPress={() => go('coupons')}
        />
        <MainTab
          name="profile"
          label={t('tab.my')}
          focused={activeName === 'profile'}
          onPress={() => go('profile')}
        />
      </View>
    </Animated.View>
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
      {/* 크루즈 모드 — 탭바에선 숨기되 탭 화면으로 두어 하단 네비 유지 */}
      <Tabs.Screen name="cruise" options={{ href: null }} />
      {/* 음성 통역 — 탭바에선 숨기되 탭 화면으로 두어 하단 네비 유지 */}
      <Tabs.Screen name="voice-interpret" options={{ href: null }} />
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
