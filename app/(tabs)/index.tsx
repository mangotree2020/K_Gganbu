// 홈 화면 — docs/K-Gganbu (standalone).html 의 HomeV2 "Daybreak" 디자인 충실 구현.
// 디자인 기능(섹션 See all·카드·타일·코어액션)을 실제 라우트로 배선해 작동하도록 함.
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTabBarAutoHide, useTabBarStore } from '@/hooks/useTabBarAutoHide'
import Svg, { Circle, G, Path, Rect } from 'react-native-svg'

import { Icon, Pill } from '@/components/brand'
import { FallbackBadge } from '@/components/FallbackBadge'
import { CatSprite, catWidth, type CatVariant } from '@/components/CatSprite'
import { HeroBackdrop } from '@/components/HeroBackdrop'
import { usePlaces, type Poi } from '@/features/map/queries'
import { useGganbuGreeting } from '@/features/gganbu/useGganbuGreeting'
import { ProfileAvatar } from '@/features/profile/Avatar'
import { track } from '@/features/analytics/service'
import { useRequireAccount } from '@/features/auth/loginPrompt'
import { matchDeal } from '@/features/coupon/matchDeal'
import { useCoupons } from '@/features/coupon/queries'
import { useCruiseStore } from '@/features/cruise/prefs'
import { getTickets, type Ticket } from '@/features/ticket/services'
import { unreadCount, useInboxStore } from '@/features/notifications/inbox'
import { stepsToPoints, useTodaySteps } from '@/features/points/pedometer'
import { useEarnSteps } from '@/features/points/queries'
import { conditionIcon, conditionLabelKey, useWeather } from '@/features/weather/queries'
import { useCityLabel } from '@/features/weather/useCityLabel'
import { useCurrentLocation } from '@/hooks/useCurrentLocation'
import { useLocaleStore, useT } from '@/lib/i18n'
import { storage } from '@/lib/mmkv'
import { supabase } from '@/lib/supabase'
import { gradients, palette, shadows } from '@/theme/tokens'

// 디자인 PLACES (실 TourAPI POI 없을 때 폴백)
const PLACES = [
  {
    id: '1',
    cat: 'seafood',
    name: 'Mipojeong',
    sub: 'Seafood · 380m',
    badge: 'Coupon',
    rating: 4.8,
  },
  { id: '2', cat: 'cafe', name: 'Blue Archive', sub: 'Cafe · 520m', badge: '10% off', rating: 4.6 },
  {
    id: '3',
    cat: 'sights',
    name: 'Blueline Park',
    sub: 'Attraction · 1.2km',
    badge: 'Popular',
    rating: 4.9,
  },
  {
    id: '4',
    cat: 'village',
    name: 'Gamcheon Village',
    sub: 'Heritage · 8.2km',
    badge: 'Must-see',
    rating: 4.9,
  },
  {
    id: '5',
    cat: 'beach',
    name: 'Haeundae Beach',
    sub: 'Beach · 200m',
    badge: 'Live cam',
    rating: 4.7,
  },
]

const SCREEN_W = Dimensions.get('window').width

// Today's Pick AI 추천 점수 — 오늘 날씨·시간(식사·저녁) 컨텍스트 반영.
// (성별·국적·여행 일정은 데이터 가용 시 가중치 확장 — 현재는 onboarding/auth 범위 내 미보유)
function pickScore(cat: string, condition: string | undefined, hour: number): number {
  let s = 0
  const indoor = ['culture', 'stay', 'shopping', 'cafe'].includes(cat)
  const outdoor = ['sights', 'beach', 'leisure', 'village'].includes(cat)
  const bad =
    condition === 'rain' || condition === 'snow' || condition === 'storm' || condition === 'fog'
  if (bad ? indoor : outdoor) s += 3
  const meal = (hour >= 11 && hour < 14) || (hour >= 17 && hour < 20)
  if (meal && (cat === 'food' || cat === 'seafood')) s += 2
  if (hour >= 18 && (cat === 'food' || cat === 'culture')) s += 1 // 저녁 분위기
  return s
}

// 좌표 거리(km) 간이 계산(Haversine)
function distKm(lat0: number, lng0: number, lat: number, lng: number): number {
  const R = 6371
  const dLat = ((lat - lat0) * Math.PI) / 180
  const dLng = ((lng - lng0) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat0 * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// 퀵 타일 (BigTile) — 디자인 톤/아이콘/라우트
const TILES = [
  {
    id: 'coupons',
    icon: 'confirmation_number',
    titleKey: 'tab.coupons',
    subKey: 'home.tileCouponsSub',
    tone: 'coral',
    badge: 'HOT',
    route: '/(tabs)/coupons',
  },
  {
    id: 'cruise', // 크루즈 고객 설정 시에만 노출(마이메뉴 토글 — useCruiseStore)
    icon: 'directions_boat',
    titleKey: 'cruise.title',
    subKey: 'home.tileCruiseSub',
    tone: 'cruise',
    route: '/cruise',
  },
  {
    id: 'courses',
    icon: 'route',
    titleKey: 'home.courses',
    subKey: 'home.tileCoursesSub',
    tone: 'teal',
    route: '/itinerary',
  },
  {
    id: 'reviews',
    icon: 'star',
    titleKey: 'home.travelers',
    subKey: 'home.tileReviewsSub',
    tone: 'amber',
    route: '/reviews',
  },
  {
    id: 'allergy',
    icon: 'medical_services',
    titleKey: 'profile.allergy',
    subKey: 'home.tileAllergySub',
    tone: 'rose',
    route: '/allergy',
  },
  {
    id: 'payment',
    icon: 'payments',
    titleKey: 'profile.payment',
    subKey: 'home.tilePaymentSub',
    tone: 'blue',
    route: '/tips',
  },
  {
    id: 'emergency',
    icon: 'emergency',
    titleKey: 'scenario.emergency',
    subKey: 'home.tileEmergencySub',
    tone: 'red',
    route: '/emergency',
  },
] as const

const TILE_TONES: Record<string, { from: string; to: string }> = {
  teal: { from: '#5EEAD4', to: '#0D9488' },
  amber: { from: '#FCD34D', to: '#D97706' },
  coral: { from: '#FDBA74', to: '#F97316' },
  blue: { from: '#7DD3FC', to: '#0284C7' },
  cruise: { from: '#60A5FA', to: '#1D4ED8' },
  rose: { from: '#FDA4AF', to: '#E11D48' },
  red: { from: '#F87171', to: '#DC2626' },
}

const COURSES = [
  {
    id: 'haeundae',
    title: 'Haeundae Half Day',
    tag: '4h',
    isCruise: false,
    stops: ['Beach', 'Blueline', 'Mipo', 'Gwangalli'],
  },
  {
    id: 'cruise',
    title: 'Cruise 6h Busan Tour',
    tag: 'Cruise',
    isCruise: true,
    stops: ['Port', 'Gamcheon', 'Jagalchi', 'Songdo'],
  },
]

const THUMB: Record<string, { from: string; to: string; icon: string; color: string }> = {
  seafood: { from: '#7DD3FC', to: '#0284C7', icon: 'set_meal', color: '#fff' },
  cafe: { from: '#FEF3C7', to: '#F59E0B', icon: 'local_cafe', color: '#78350F' },
  sights: { from: '#CCFBF1', to: '#2DD4BF', icon: 'photo_camera', color: '#115E59' },
  village: { from: '#FDBA74', to: '#F97316', icon: 'holiday_village', color: '#fff' },
  beach: { from: '#BAE6FD', to: '#0EA5E9', icon: 'beach_access', color: '#0C4A6E' },
}

const BADGE_TONE: Record<string, 'blue' | 'amber' | 'coral'> = {
  Popular: 'blue',
  '10% off': 'amber',
}

// 도시 실루엣 (디자인 SVG)
function CitySilhouette() {
  return (
    <Svg
      viewBox="0 0 380 260"
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
      opacity={0.4}>
      <Circle cx={300} cy={80} r={50} fill="rgba(255,255,255,.35)" />
      <Circle cx={300} cy={80} r={32} fill="rgba(255,255,255,.5)" />
      <Path
        d="M0 220 L60 160 L110 200 L160 130 L220 180 L290 110 L380 170 L380 260 L0 260 Z"
        fill="rgba(15,23,42,.18)"
      />
      <Path
        d="M0 240 L40 195 L90 220 L150 175 L200 210 L260 170 L320 200 L380 175 L380 260 L0 260 Z"
        fill="rgba(15,23,42,.28)"
      />
      <G fill="rgba(15,23,42,.42)">
        <Rect x={40} y={195} width={14} height={55} />
        <Rect x={60} y={210} width={22} height={40} />
        <Rect x={86} y={180} width={10} height={70} />
        <Rect x={100} y={200} width={16} height={50} />
        <Rect x={140} y={190} width={12} height={60} />
        <Rect x={160} y={205} width={20} height={45} />
        <Rect x={200} y={175} width={11} height={75} />
        <Rect x={216} y={200} width={18} height={50} />
        <Rect x={252} y={195} width={14} height={55} />
        <Rect x={272} y={180} width={10} height={70} />
        <Rect x={294} y={200} width={18} height={50} />
        <Rect x={320} y={190} width={13} height={60} />
        <Rect x={340} y={205} width={20} height={45} />
      </G>
    </Svg>
  )
}

// 현지 날짜·시간 라이브 표시 — 기기 현지 시간을 앱 언어로 포맷, 분 단위로 갱신.
function LiveDateTime({ lang }: { lang: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000) // 15초마다 갱신
    return () => clearInterval(id)
  }, [])
  let date = ''
  let time = ''
  try {
    date = new Intl.DateTimeFormat(lang, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(now)
    time = new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit' }).format(now)
  } catch {
    date = now.toDateString()
    time = now.toTimeString().slice(0, 5)
  }
  return (
    <Text style={ss.dateTime}>
      {date} · {time}
    </Text>
  )
}

function PlaceThumb({ category, height = 92 }: { category: string; height?: number }) {
  const c = THUMB[category] ?? THUMB.sights
  return (
    <LinearGradient
      colors={[c.from, c.to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ height, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <View
        style={{
          position: 'absolute',
          bottom: -height * 0.5,
          width: '140%',
          height,
          backgroundColor: 'rgba(255,255,255,.18)',
          borderRadius: 999,
        }}
      />
      <Icon name={c.icon} size={Math.floor(height * 0.42)} color={c.color} filled />
    </LinearGradient>
  )
}

// 주변 추천 헤더 장식 — 스프라이트 고양이가 플릭 진행도를 따라 조금씩 걸어간다.
// 현재 카드가 근거리(≤2.5km)면 걷기, 원거리면 달리기 모션(두 모션의 실제 크기는 동일 축척).
// 새 추천 카드가 중앙에 올 때마다 야옹 소리를 낸다.
let meowPlayer: { seekTo: (s: number) => void; play: () => void } | null = null
let lastMeowAt = 0
function playMeow() {
  // 연속 플릭·스크롤 중 다중 재생 방지 — 800ms 스로틀(플릭당 한 번)
  const now = Date.now()
  if (now - lastMeowAt < 800) return
  lastMeowAt = now
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio')
    if (!meowPlayer) meowPlayer = createAudioPlayer(require('../../assets/cats/meow.wav'))
    meowPlayer.seekTo(0)
    meowPlayer.play()
  } catch {
    // 오디오 미지원/구 빌드 — 무음
  }
}

// 도킹형 플로팅 버튼 — 탭바 노출 중엔 우측으로 밀어 아이콘만 보이고,
// 탭바가 숨으면(스크롤 다운) 슬라이드로 전체 노출. 도킹 상태에서도 탭 가능.
const FAB_PEEK_W = 44 // 도킹 시 화면에 남기는 폭 — 좌측 패딩 16 + 아이콘까지만(라벨 숨김)

function DockedFab({
  docked,
  onPress,
  style,
  children,
}: {
  docked: boolean
  onPress: () => void
  style?: object | object[]
  children: React.ReactNode
}) {
  const [w, setW] = useState(0)
  const anim = useState(() => new Animated.Value(docked ? 1 : 0))[0]
  useEffect(() => {
    Animated.timing(anim, {
      toValue: docked ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start()
  }, [docked, anim])
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, w - FAB_PEEK_W)],
  })
  return (
    <Animated.View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ transform: [{ translateX }] }}>
      <Pressable
        onPress={onPress}
        android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: false }}
        style={style}>
        {children}
      </Pressable>
    </Animated.View>
  )
}

function NearbyTrail({ km, idx, count }: { km: number | null; idx: number; count: number }) {
  const far = (km ?? 0) > 2.5
  const [trackW, setTrackW] = useState(0)
  const pos = useState(() => new Animated.Value(0))[0]
  // 상태 머신: walk/run 루프 + turn(방향 전환)/jump(걷기→달리기 전환) 원샷.
  // 꼬임 방지: "희망 방향(desiredFacing)"과 "현재 방향(facing)"을 분리하고,
  // 원샷이 끝날 때마다 대사(reconcile) — 원샷 중 방향이 또 바뀌어도 스스로 수렴한다.
  const [anim, setAnim] = useState<CatVariant>('walk')
  const [facing, setFacing] = useState<1 | -1>(1)
  const [desiredFacing, setDesiredFacing] = useState<1 | -1>(1)
  const desiredFacingRef = useRef<1 | -1>(1)
  useEffect(() => {
    desiredFacingRef.current = desiredFacing
  }, [desiredFacing])
  // 플릭 진행도(0~1)에 비례해 고양이가 트랙 위를 이동 — 플릭 방향으로 한 걸음씩
  const progress = count > 1 ? Math.min(1, Math.max(0, idx / (count - 1))) : 0
  useEffect(() => {
    // 제자리 턴 — 턴 재생 중에는 이동을 멈추고, 끝나면 이 이펙트가 다시 돌며 이동 재개
    if (anim === 'turn') {
      pos.stopAnimation()
      return
    }
    Animated.timing(pos, { toValue: progress, duration: 500, useNativeDriver: true }).start()
  }, [progress, pos, anim])
  // 새 추천 카드가 중앙에 오면(플릭) 야옹 + 희망 방향 갱신
  const firstRef = useRef(true)
  const prevIdxRef = useRef(idx)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const prev = prevIdxRef.current
    prevIdxRef.current = idx
    if (firstRef.current) {
      firstRef.current = false
      return
    }
    if (idx !== prev) {
      setDesiredFacing(idx > prev ? 1 : -1) // 야옹은 플릭 제스처 단위로(스크롤뷰 쪽에서 재생)
    }
  }, [idx])
  // 상태 대사(reconcile) — 원샷이 아닐 때만 판단. 방향 불일치 → turn,
  // 그다음 속도 불일치 → jump(걷→달) 또는 즉시 걷기 복귀(달→걷).
  useEffect(() => {
    if (anim === 'turn' || anim === 'jump') return
    if (desiredFacing !== facing) setAnim('turn')
    else if (far && anim === 'walk') setAnim('jump')
    else if (!far && anim === 'run') setAnim('walk')
  }, [far, anim, desiredFacing, facing])
  /* eslint-enable react-hooks/set-state-in-effect */
  const onOneShotEnd = () => {
    if (anim === 'turn') setFacing(desiredFacingRef.current)
    // 점프 후 달리기 / 그 외엔 걷기로 복귀 — 남은 불일치는 reconcile이 이어서 처리
    setAnim(anim === 'jump' && far ? 'run' : 'walk')
  }
  // turn 시트는 우→좌 회전 원본 — 이전 방향(facing) 기준으로 반전해 좌→우 회전도 표현
  const flip = facing
  const catW = catWidth(anim)
  return (
    // 행 높이는 라벨에 맞춰 압축(28) — 고양이는 행 위로 넘겨(bottom: 12) 위 섹션(오늘의 딜)
    // 하단에 살짝 겹치는 레이어로 보이게 한다. RN 기본 overflow visible + 뒤 형제가 위에 그려짐.
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 4,
        marginLeft: 8,
        height: 28,
      }}>
      <View
        style={{ flex: 1, height: 28, justifyContent: 'flex-end' }}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
        {trackW > 60 && (
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              bottom: 12,
              transform: [
                {
                  translateX: pos.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.max(0, trackW - catW - 2)],
                  }),
                },
              ],
            }}>
            <View style={{ transform: [{ scaleX: flip }] }}>
              <CatSprite variant={anim} onEnd={onOneShotEnd} />
            </View>
          </Animated.View>
        )}
      </View>
      {km != null && (
        // 거리 → 발 아이콘 → 예상 걸음수(1km≈1,350보) — Today's Pick과 동일 형식
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            marginRight: 8,
            marginBottom: 4,
          }}>
          <Text style={{ color: palette.blue[50], fontSize: 12, fontWeight: '800' }}>
            {km.toFixed(1)}km
          </Text>
          <Icon name="directions_walk" size={13} color={palette.blue[50]} filled />
          <Text style={{ color: palette.blue[50], fontSize: 12, fontWeight: '800' }}>
            {Math.round(km * 1350).toLocaleString()}
          </Text>
        </View>
      )}
    </View>
  )
}

function SectionHeader({
  title,
  sub,
  action,
  onAction,
}: {
  title?: string
  sub?: string
  action?: string
  onAction?: () => void
}) {
  return (
    <View style={ss.sectionHead}>
      {/* 부제는 타이틀 옆에 나란히(같은 행) */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flex: 1 }}>
        {!!title && <Text style={ss.sectionTitle}>{title}</Text>}
        {!!sub && <Text style={ss.sectionSub}>{sub}</Text>}
      </View>
      {!!action && (
        <Pressable onPress={onAction} style={ss.sectionAction} hitSlop={6}>
          <Text style={ss.sectionActionText}>{action}</Text>
          <Icon name="chevron_right" size={14} color={palette.blue[50]} />
        </Pressable>
      )}
    </View>
  )
}

function BigTile({ tile, t }: { tile: (typeof TILES)[number]; t: (k: string) => string }) {
  const tone = TILE_TONES[tile.tone]
  return (
    <Pressable onPress={() => router.push(tile.route as never)} style={ss.bigTile}>
      <LinearGradient
        colors={[tone.from, tone.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={ss.bigTileGrad}>
        <View style={ss.bigTileTop}>
          <View style={ss.bigTileIcon}>
            <Icon name={tile.icon} size={18} color="#fff" filled />
          </View>
          {'badge' in tile && tile.badge && (
            <View style={ss.bigTileBadge}>
              <Text style={ss.bigTileBadgeText}>{tile.badge}</Text>
            </View>
          )}
        </View>
        <View>
          <Text style={ss.bigTileTitle} numberOfLines={1}>
            {t(tile.titleKey)}
          </Text>
          <Text style={ss.bigTileSub} numberOfLines={3}>
            {t(tile.subKey)}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  )
}

// 추천 장소 ↔ 오늘의 딜(쿠폰·티켓) 매칭 — LBS 근접성 우선(BM §5 S-7).
// 공용 모듈 @/features/coupon/matchDeal 사용(지도 장소 시트·AI 추천 카드와 동일 판정).

function PlaceCard({
  cat,
  name,
  sub,
  rating,
  badge,
  imageUrl,
  extId,
  lat,
  lng,
}: {
  cat: string
  name: string
  sub: string
  rating?: number
  badge?: string
  imageUrl?: string | null
  extId?: string
  lat?: number | null
  lng?: number | null
}) {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/place',
          params: {
            cat,
            name,
            sub,
            rating: rating ? String(rating) : '',
            badge: badge ?? '',
            img: imageUrl ?? '',
            extId: extId ?? '',
            lat: lat != null ? String(lat) : '',
            lng: lng != null ? String(lng) : '',
          },
        })
      }
      style={[ss.placeCard, shadows.card]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: '100%', height: 92 }}
          resizeMode="cover"
        />
      ) : (
        <PlaceThumb category={cat} height={92} />
      )}
      <View style={{ padding: 8, paddingBottom: 10 }}>
        <Text style={ss.placeName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={ss.placeSub} numberOfLines={1}>
          {sub}
        </Text>
        <View style={ss.placeBottom}>
          {rating != null && (
            <View style={ss.row}>
              <Icon name="star" size={12} color={palette.amber[50]} filled />
              <Text style={ss.placeRating}> {rating}</Text>
            </View>
          )}
          {!!badge && (
            <Pill tone={BADGE_TONE[badge] ?? 'coral'} size="xs">
              {badge}
            </Pill>
          )}
        </View>
      </View>
    </Pressable>
  )
}

function CourseCard({ course }: { course: (typeof COURSES)[number] }) {
  const accent = course.isCruise ? palette.cruise.base : palette.blue[50]
  const iconBg = course.isCruise ? palette.cruise[90] : palette.blue[90]
  return (
    <Pressable
      onPress={() => router.push((course.isCruise ? '/cruise' : '/itinerary') as never)}
      style={[ss.courseCard, shadows.card]}>
      <View style={ss.courseRow}>
        <View style={[ss.courseIcon, { backgroundColor: iconBg }]}>
          <Icon
            name={course.isCruise ? 'directions_boat' : 'trip_origin'}
            size={16}
            color={accent}
            filled={course.isCruise}
          />
        </View>
        <Text style={ss.courseTitle}>{course.title}</Text>
        <Pill tone={course.isCruise ? 'cruise' : 'coral'} size="sm">
          {course.tag}
        </Pill>
      </View>
      <View style={ss.courseStops}>
        {course.stops.map((s, i) => (
          <View key={s} style={ss.row}>
            <View style={[ss.courseDot, { backgroundColor: accent }]} />
            <Text style={ss.courseStop}>{s}</Text>
            {i < course.stops.length - 1 && (
              <Icon name="arrow_right_alt" size={14} color={palette.zinc[300]} />
            )}
          </View>
        ))}
      </View>
    </Pressable>
  )
}

const REVIEWS = [
  {
    name: 'Yuki · 🇯🇵',
    text: "Mipojeong's gukbap is everything. Got the 10% coupon working — easy.",
    time: '2h',
  },
  {
    name: 'Alex · 🇺🇸',
    text: 'Translate camera saved me from a pork dish — peanut allergy section is excellent.',
    time: '5h',
  },
]

export default function HomeScreen() {
  const t = useT()
  const insets = useSafeAreaInsets() // 상태바 영역 틴트 높이 계산용
  const tabBarHidden = useTabBarStore((s) => s.hidden) // 탭바 숨김 시 플로팅 버튼 위치 보정
  const tabBarAutoHide = useTabBarAutoHide() // 스크롤 방향 따라 하단 탭바 자동 숨김/표시
  const lang = useLocaleStore((s) => s.lang)
  const notifUnread = unreadCount(useInboxStore((s) => s.items))
  const { data: placesData } = usePlaces(lang, 12)
  const pois = placesData?.pois
  const poisMock = placesData?.provider === 'mock'

  // 실시간 위치·날씨·도시명
  const { coords } = useCurrentLocation()
  const { data: weather } = useWeather(coords)
  const { steps, walking } = useTodaySteps() // 만보기 — 측정 불가면 null(위젯 숨김)
  const isCruise = useCruiseStore((s) => s.isCruise) // 크루즈 고객만 크루즈 타일 노출
  const requireAccount = useRequireAccount()

  // 걸음 포인트 적립(REQ-PD-2·PT-4) — 배지 탭 → 서버 적립(하루 1회 멱등), 게스트는 로그인 유도
  const earnSteps = useEarnSteps()
  const [stepsMsg, setStepsMsg] = useState<string | null>(null)
  const claimSteps = () => {
    if (!steps || earnSteps.isPending || stepsMsg) return
    requireAccount('auth.gatePoints', async () => {
      try {
        const r = await earnSteps.mutateAsync(steps)
        const msg = r.duplicate
          ? t('points.claimedToday')
          : r.granted && r.granted > 0
            ? t('points.claimed').replace('{n}', String(r.granted))
            : t('points.claimedToday') // 상한 도달·1000보 미만도 동일 안내
        setStepsMsg(msg)
      } catch {
        setStepsMsg(null)
        return
      }
      setTimeout(() => setStepsMsg(null), 2500)
    })
  }

  // 오늘의 딜 — 쿠폰·티켓을 번갈아 섞은 슬라이드(썸네일+할인). 탭 시 해당 상세로 즉시 이동.
  const { data: dealCoupons } = useCoupons()
  const [dealTickets, setDealTickets] = useState<Ticket[]>([])
  useEffect(() => {
    let alive = true
    getTickets().then((ts) => alive && setDealTickets(ts))
    return () => {
      alive = false
    }
  }, [])
  // LBS 매칭 풀 — 티켓은 title→name 매핑해 쿠폰과 동일 계약(matchDeal)으로 매칭
  const ticketDeals = useMemo(
    () => dealTickets.map((x) => ({ ...x, name: x.title })),
    [dealTickets],
  )
  // 추천 카드 할인 배지 라벨 — 쿠폰 우선(할인율), 없으면 티켓(가격)
  const dealBadgeFor = (p: { name: string; lat?: number | null; lng?: number | null }) => {
    const c = matchDeal(p, dealCoupons ?? [])
    if (c) return c.disc
    const tk = matchDeal(p, ticketDeals)
    return tk ? `₩${tk.price.toLocaleString()}` : undefined
  }
  // 추천 코스 섹션 — 크루즈 고객은 딜·주변보다 위에 배치(S-7 3순위:
  // 기항 체류 시간 내 동선 계획이 우선 가치), 일반 고객은 기존 위치 유지
  const coursesSection = (
    <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
      <SectionHeader
        title={t('home.courses')}
        action={t('home.seeAll')}
        onAction={() => router.push('/itinerary' as never)}
      />
      <View style={{ gap: 10 }}>
        {COURSES.map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </View>
    </View>
  )
  const deals = useMemo(() => {
    type Deal = {
      kind: 'coupon' | 'ticket'
      id: string
      title: string
      sub: string
      disc: string
      thumb: string
      onPress: () => void
    }
    const cs: Deal[] = (dealCoupons ?? []).slice(0, 3).map((c) => ({
      kind: 'coupon',
      id: String(c.id),
      title: c.name,
      sub: `${c.detail} · ${c.dist}`,
      disc: c.disc,
      thumb: c.cat,
      onPress: () => {
        track('coupon_tap', {
          coupon_id: String(c.id),
          name: c.name,
          cat: c.filter,
          is_mock: false,
        })
        requireAccount('auth.gateCoupon', () =>
          router.push({
            pathname: '/coupon-qr',
            // 매장 정보 카드(썸네일·거리) 표시용 부가 파라미터 포함
            params: {
              id: String(c.id),
              name: c.name,
              disc: c.disc,
              detail: c.detail,
              dist: c.dist,
            },
          }),
        )
      },
    }))
    const ts: Deal[] = dealTickets.slice(0, 3).map((x) => ({
      kind: 'ticket',
      id: x.id,
      title: x.title,
      sub: x.provider,
      disc: `₩${x.price.toLocaleString()}`,
      thumb: x.thumb,
      onPress: () => {
        track('ticket_outlink', { ticket_id: String(x.id), category: x.category })
        Linking.openURL(x.outlinkUrl).catch(() => {})
      },
    }))
    // 쿠폰·티켓 교차 배치
    const out: Deal[] = []
    for (let i = 0; i < Math.max(cs.length, ts.length); i++) {
      if (cs[i]) out.push(cs[i])
      if (ts[i]) out.push(ts[i])
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealCoupons, dealTickets])
  // 딜 실사진 썸네일 — place-lookup(photoName)으로 장소 대표 사진 URL 확보(MMKV 7일 캐시)
  const [dealPhotos, setDealPhotos] = useState<Record<string, string | null>>({})
  useEffect(() => {
    let alive = true
    ;(async () => {
      for (const d of deals) {
        if (dealPhotos[d.title] !== undefined) continue
        const ck = `dealphoto:${d.title}`
        const cached = storage.getString(ck)
        if (cached !== undefined && cached !== null) {
          const val = cached === '' ? null : cached
          if (alive) setDealPhotos((m) => ({ ...m, [d.title]: val }))
          continue
        }
        try {
          const { data } = await supabase.functions.invoke('place-lookup', {
            body: { photoName: `${d.title} Busan` },
          })
          const url: string | null = data?.url ?? null
          storage.set(ck, url ?? '')
          if (alive) setDealPhotos((m) => ({ ...m, [d.title]: url }))
        } catch {
          if (alive) setDealPhotos((m) => ({ ...m, [d.title]: null }))
        }
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals])
  // 걷는 중 도보 아이콘 바운스 애니메이션 (걸음 감지 시에만 동작)
  const walkBounce = useState(() => new Animated.Value(0))[0]
  useEffect(() => {
    if (!walking) {
      walkBounce.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(walkBounce, { toValue: -3, duration: 240, useNativeDriver: true }),
        Animated.timing(walkBounce, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [walking, walkBounce])
  const city = useCityLabel(coords, lang)
  const hour = new Date().getHours()
  // AI 깐부 인사 — 앱 시작 시 greeting, 이후 장소·시간·날씨 맞춤 메시지 30초 순환(변경 시 TTS)
  const shortCity = city?.split(',').pop()?.trim() || 'Busan'
  // 답변(추천)용 최근접 장소 — 질문 낭독 뒤 깐부가 이어 말한다
  const nearestForAnswer = useMemo(() => {
    const list = (pois ?? []).filter((p) => p.lat != null && p.lng != null)
    if (!list.length) return null
    const best = list
      .map((p) => ({ p, d: distKm(coords.latitude, coords.longitude, p.lat!, p.lng!) }))
      .sort((a, b) => a.d - b.d)[0]
    return { name: best.p.name, km: best.d }
  }, [pois, coords.latitude, coords.longitude])
  const gganbuMsg = useGganbuGreeting({
    lang,
    city: shortCity,
    condition: weather?.condition,
    hour,
    nearby: nearestForAnswer,
  })
  // Today's Pick — AI가 오늘 날씨·위치·시간 고려해 동적 추천.
  // 하루 단위 누적 덱(MMKV): 기본 3개로 시작해 매시간 새 추천이 앞에 추가(내역 누적),
  // 날짜가 바뀌면 새로운 기본 3개로 리셋. 좌우 스와이프로 오늘의 내역 확인.
  const todaysPicks = useMemo(() => {
    const withImg = (pois ?? []).filter((p) => p.imageUrl)
    if (!withImg.length) return []
    const ranked = withImg
      .map((p) => ({ p, score: pickScore(p.cat, weather?.condition, hour) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p)
    // 도보 접근(≤2.5km) 2개 → 원거리 1개 반복 루틴으로 선별
    const WALKABLE_KM = 2.5
    const isWalkable = (p: Poi) =>
      p.lat != null &&
      p.lng != null &&
      distKm(coords.latitude, coords.longitude, p.lat, p.lng) <= WALKABLE_KM
    const walkPool = ranked.filter(isWalkable)
    const farPool = ranked.filter((p) => !isWalkable(p))
    const pickNext = (ids: string[]): Poi | undefined => {
      const wantWalk = ids.length % 3 !== 2 // 0,1번째=도보 / 2번째=원거리 (3개 주기 반복)
      const primary = wantWalk ? walkPool : farPool
      const fallback = wantWalk ? farPool : walkPool
      return primary.find((p) => !ids.includes(p.id)) ?? fallback.find((p) => !ids.includes(p.id))
    }
    const d = new Date()
    const dkey = `picks:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    let deck: { ids: string[]; lastHour: number } = { ids: [], lastHour: hour }
    try {
      deck = JSON.parse(storage.getString(dkey) ?? '') as typeof deck
    } catch {
      // 오늘 첫 방문 — 아래에서 기본 3개 시드
    }
    // 오늘 목록에서 사라진 POI(언어 전환 등) 제거
    deck.ids = (deck.ids ?? []).filter((id) => ranked.some((p) => p.id === id))
    if (!deck.ids.length) {
      // 새 날 기본 3개 — 도보 2 + 원거리 1
      for (let i = 0; i < 3; i++) {
        const next = pickNext(deck.ids)
        if (next) deck.ids.push(next.id)
      }
      deck.lastHour = hour
    } else if (hour > deck.lastHour) {
      // 지난 시간 수만큼 새 추천을 앞에 추가(누적) — 루틴 패턴 유지
      for (let i = 0; i < hour - deck.lastHour; i++) {
        const next = pickNext(deck.ids)
        if (next) deck.ids.unshift(next.id)
      }
      deck.lastHour = hour
    }
    storage.set(dkey, JSON.stringify(deck))
    return deck.ids
      .map((id) => ranked.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pois, weather?.condition, hour])
  // 현재 보이는 추천 카드 인덱스 — 헤더 우측 거리·예상 걸음수 표시용
  const [pickIdx, setPickIdx] = useState(0)
  const currentPick = todaysPicks[Math.min(pickIdx, todaysPicks.length - 1)]
  const pickDistKm =
    currentPick?.lat != null && currentPick?.lng != null
      ? distKm(coords.latitude, coords.longitude, currentPick.lat, currentPick.lng)
      : null
  // 주변 추천 정렬 — ① 내 위치 5km 이내에서 가까운 순 최대 5개
  // ② 나머지(5km 밖 + 초과분)는 거리 제한 없이 같은 지역 추천을 거리순으로 이어붙임
  const nearbyPois = useMemo(() => {
    const list = (pois ?? []).filter((p) => p.lat != null && p.lng != null)
    const withDist = list
      .map((p) => ({ p, d: distKm(coords.latitude, coords.longitude, p.lat!, p.lng!) }))
      .sort((a, b) => a.d - b.d)
    const near = withDist.filter((x) => x.d <= 5).slice(0, 5)
    const rest = withDist.filter((x) => !near.includes(x))
    return [...near, ...rest].map((x) => x.p)
  }, [pois, coords.latitude, coords.longitude])

  // 주변 추천 — 현재 플릭 중앙 카드 인덱스(헤더 거리 표시용) + 플릭 시작 인덱스(야옹 1회 판정)
  const [nearbyIdx, setNearbyIdx] = useState(0)
  const nearbyDragFromRef = useRef(0)

  // hero 배경용 관광지 사진 — 이미지 있는 POI만(최대 6장 순환).
  // useMemo로 참조 고정: 매 렌더마다 새 배열이면 HeroBackdrop 인터벌이 리셋돼 10초 회전이 끊김.
  const heroPhotos = useMemo(
    () =>
      (pois ?? [])
        .map((p) => p.imageUrl)
        .filter((u): u is string => !!u)
        .slice(0, 6),
    [pois],
  )

  return (
    <View style={ss.container}>
      <ScrollView showsVerticalScrollIndicator={false} {...tabBarAutoHide}>
        {/* ── HERO ── */}
        <View style={ss.hero}>
          {/* 현재 위치 관광지 사진 배경(동적 순환) + 브랜드 틴트 + 폴백 실루엣 + 가독성 스크림 */}
          {heroPhotos.length > 0 && <HeroBackdrop photos={heroPhotos} />}
          <LinearGradient
            colors={gradients.morning}
            locations={[0, 0.45, 1]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.4, y: 1 }}
            style={[StyleSheet.absoluteFill, heroPhotos.length > 0 ? { opacity: 0.28 } : null]}
          />
          {heroPhotos.length === 0 && <CitySilhouette />}
          {heroPhotos.length > 0 && (
            // 상단(인사말·날씨) 가독성 — 위는 어둡게, 아래로 투명
            <LinearGradient
              colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.18)', 'transparent']}
              locations={[0, 0.45, 0.85]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.3, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          {heroPhotos.length > 0 && (
            // 좌측(텍스트 정렬 영역) 가독성 — 왼쪽을 살짝 어둡게, 오른쪽으로 투명
            <LinearGradient
              colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0.14)', 'transparent']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          )}
          {/* 상태바 영역 틴트 — 배경 사진과 무관하게 시간·배터리 가독성 확보.
              My(프로필) 헤더와 동일한 스카이블루 계열, 아래로 자연스럽게 투명 */}
          <LinearGradient
            colors={['#38BDF8', 'rgba(56,189,248,0.6)', 'rgba(56,189,248,0)']}
            locations={[0, 0.7, 1]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: insets.top + 20,
            }}
            pointerEvents="none"
          />
          <SafeAreaView edges={['top']}>
            {/* 상단 행 */}
            <View style={ss.heroTop}>
              <Pressable style={ss.locationPill} hitSlop={4}>
                <Icon name="location_on" size={12} color="#fff" filled />
                <Text style={ss.locationText}>{city ?? 'Busan'}</Text>
                <Icon name="expand_more" size={14} color="#fff" />
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {/* 만보기 배지(REQ-PD-3) — 알림·프로필 옆 상시 노출, 걷는 중이면 아이콘 바운스.
                    탭하면 걸음 포인트 적립(하루 1회, 게스트는 로그인 유도) */}
                {steps != null && (
                  <Pressable onPress={claimSteps} style={ss.stepsPill} hitSlop={6}>
                    <Animated.View style={{ transform: [{ translateY: walkBounce }] }}>
                      <Icon name="directions_walk" size={14} color="#fff" filled />
                    </Animated.View>
                    {stepsMsg ? (
                      <Text style={ss.stepsPillPts}>{stepsMsg}</Text>
                    ) : (
                      <>
                        <Text style={ss.stepsPillText}>{steps.toLocaleString()}</Text>
                        <Text style={ss.stepsPillPts}>+{stepsToPoints(steps)}P</Text>
                      </>
                    )}
                  </Pressable>
                )}
                <Pressable
                  style={ss.iconBtn}
                  onPress={() => router.push('/notifications' as never)}>
                  <Icon name="notifications" size={18} color="#fff" filled />
                  {notifUnread > 0 && (
                    <View style={ss.iconBadge}>
                      <Text style={ss.iconBadgeText}>{notifUnread > 9 ? '9+' : notifUnread}</Text>
                    </View>
                  )}
                </Pressable>
                <Pressable style={ss.iconBtn} onPress={() => router.push('/profile-edit' as never)}>
                  <ProfileAvatar size={32} />
                </Pressable>
              </View>
            </View>

            {/* 인사말 */}
            <Text style={gganbuMsg.isGreeting ? ss.greeting : ss.gganbuMsg} numberOfLines={2}>
              {gganbuMsg.text}
            </Text>
            <LiveDateTime lang={lang} />
            <View style={ss.weatherRow}>
              <Icon
                name={weather ? conditionIcon[weather.condition] : 'weather_clear'}
                size={15}
                color="#fff"
                filled
              />
              <Text style={ss.weatherText}>
                {weather ? `${weather.tempC}° ${t(conditionLabelKey[weather.condition])}` : '—'}
              </Text>
              <Text style={ss.weatherDot}>·</Text>
              {weather?.waveM != null ? (
                <>
                  <Icon name="waves" size={14} color="#fff" filled />
                  <Text style={ss.weatherText}>
                    {t('home.wave')} {weather.waveM}m
                  </Text>
                </>
              ) : (
                <>
                  <Icon name="wind" size={14} color="#fff" />
                  <Text style={ss.weatherText}>{weather?.windKph ?? 0}km/h</Text>
                </>
              )}
            </View>

            {/* 검색 Input Box 삭제 — 텍스트 입력 최소화 방향(요청). 음성/탭 기반 탐색으로 대체 */}
          </SafeAreaView>
          {/* 히어로 우측 하단 스피커 — 질문·답변 낭독 소리 켜기/끄기(설정 유지) */}
          <Pressable onPress={gganbuMsg.toggleMute} hitSlop={8} style={ss.heroMic}>
            <Icon
              name={gganbuMsg.muted ? 'volume_off' : 'volume_up'}
              size={18}
              color="#fff"
              filled
            />
          </Pressable>
        </View>

        {/* AI 카드는 플로팅 AI 깐부 버튼과 중복되어 제거(요청). */}

        {/* ── 퀵 타일 ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingTop: 12 }}>
          {TILES.filter((tile) => tile.id !== 'cruise' || isCruise).map((tile) => (
            <BigTile key={tile.id} tile={tile} t={t} />
          ))}
        </ScrollView>

        {/* ── Today's pick — AI 동적 추천(날씨·위치·시간), 1시간마다 변경, 좌우 스와이프 내역 ── */}
        <View style={{ paddingTop: 16 }}>
          <View style={{ paddingHorizontal: 16 }}>
            <View style={ss.sectionHead}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flex: 1 }}>
                <Text style={ss.sectionTitle}>{t('home.todayPick')}</Text>
                <Text style={ss.sectionSub}>{t('home.curatedByAi')}</Text>
              </View>
              {/* 현재 카드까지의 거리 + 예상 걸음수(1km≈1,350보) — 깐부 블루 */}
              {pickDistKm != null && (
                // 순서: 거리 → 발 아이콘 → 예상 걸음수(아이콘 뒤 숫자 = 걸음수로 즉시 인식)
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Text style={ss.pickDistText}>{pickDistKm.toFixed(1)}km</Text>
                  <Icon name="directions_walk" size={14} color={palette.blue[50]} filled />
                  <Text style={ss.pickDistText}>
                    {Math.round(pickDistKm * 1350).toLocaleString()}
                  </Text>
                </View>
              )}
            </View>
          </View>
          {todaysPicks.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={SCREEN_W - 62}
              decelerationRate="fast"
              onMomentumScrollEnd={(e) =>
                setPickIdx(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - 62)))
              }
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {todaysPicks.map((p, i) => {
                // 이 장소의 오늘의 딜 — LBS 근접 매칭. 쿠폰 우선(QR 직행), 없으면 티켓(아웃링크)
                const deal = matchDeal(p, dealCoupons ?? [])
                const ticket = deal ? null : matchDeal(p, ticketDeals)
                return (
                  <Pressable
                    key={p.id}
                    onPress={() =>
                      router.push({
                        pathname: '/place',
                        params: {
                          cat: p.cat,
                          name: p.name,
                          sub: p.address ?? 'Busan',
                          img: p.imageUrl ?? '',
                          extId: p.id,
                          lat: p.lat != null ? String(p.lat) : '',
                          lng: p.lng != null ? String(p.lng) : '',
                        },
                      })
                    }
                    style={[ss.pickCard, { width: SCREEN_W - 72 }, shadows.card]}>
                    <Image
                      source={{ uri: p.imageUrl as string }}
                      style={{ width: '100%', height: 148 }}
                      resizeMode="cover"
                    />
                    <View style={ss.pickTrending}>
                      <Icon name="auto_awesome" size={12} color={palette.blue[50]} filled />
                      <Text style={ss.pickTrendingText}>
                        {' '}
                        {i === 0 ? t('home.aiPickNow') : t('home.aiPick')}
                      </Text>
                    </View>
                    {deal && (
                      <Pressable
                        onPress={() =>
                          requireAccount('auth.gateCoupon', () =>
                            router.push({
                              pathname: '/coupon-qr',
                              params: {
                                id: String(deal.id),
                                name: deal.name,
                                disc: deal.disc,
                                detail: deal.detail,
                                dist: deal.dist,
                              },
                            }),
                          )
                        }
                        style={ss.pickDealBadge}>
                        <Text style={ss.pickDealText}>🎟 {deal.disc}</Text>
                      </Pressable>
                    )}
                    {ticket && (
                      <Pressable
                        onPress={() => {
                          track('ticket_outlink', {
                            ticket_id: String(ticket.id),
                            category: ticket.category,
                          })
                          Linking.openURL(ticket.outlinkUrl).catch(() => {})
                        }}
                        style={ss.pickDealBadge}>
                        <Text style={ss.pickDealText}>🎫 ₩{ticket.price.toLocaleString()}</Text>
                      </Pressable>
                    )}
                    <View style={ss.pickScrim} />
                    <View style={ss.pickOverlay}>
                      <Text style={ss.pickName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <View style={[ss.row, { gap: 10, marginTop: 2 }]}>
                        <View style={ss.row}>
                          <Icon name="location_on" size={12} color="#fff" filled />
                          <Text style={ss.pickMeta} numberOfLines={1}>
                            {' '}
                            {p.address ?? 'Busan'}
                          </Text>
                        </View>
                        {p.lat != null && p.lng != null && (
                          <View style={ss.row}>
                            <Icon name="directions_walk" size={12} color="#fff" />
                            <Text style={ss.pickMeta}>
                              {' '}
                              {distKm(coords.latitude, coords.longitude, p.lat, p.lng).toFixed(1)}km
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                )
              })}
            </ScrollView>
          ) : (
            <View style={{ paddingHorizontal: 16 }}>
              <View style={[ss.pickCard, shadows.card]}>
                <PlaceThumb category="village" height={148} />
                <View style={ss.pickScrim} />
                <View style={ss.pickOverlay}>
                  <Text style={ss.pickName}>Gamcheon Culture Village</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* 크루즈 고객: 추천 코스를 딜 위로 (S-7 3순위) */}
        {isCruise && coursesSection}

        {/* ── Today's deals ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <SectionHeader
            title={t('home.deals')}
            action={t('home.seeAll')}
            onAction={() => router.push('/(tabs)/coupons' as never)}
          />
          {/* 쿠폰·티켓 교차 슬라이드 — 수평 플릭, 탭 시 해당 상세로 즉시 이동 */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={SCREEN_W - 72}
            decelerationRate="fast"
            contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
            {deals.map((d) => (
              <Pressable
                key={`${d.kind}-${d.id}`}
                onPress={d.onPress}
                style={[ss.dealCard, { width: SCREEN_W - 82 }]}>
                <View style={{ width: 64, height: 64, borderRadius: 14, overflow: 'hidden' }}>
                  {dealPhotos[d.title] ? (
                    <Image
                      source={{ uri: dealPhotos[d.title] as string }}
                      style={{ width: 64, height: 64 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <PlaceThumb category={d.thumb} height={64} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Pill tone={d.kind === 'coupon' ? 'coral' : 'blue'} size="sm">
                      {d.kind === 'coupon' ? t('home.dealCoupon') : t('home.dealTicket')}
                    </Pill>
                  </View>
                  <Text style={ss.dealName} numberOfLines={1}>
                    {d.title}
                  </Text>
                  <Text style={ss.dealSub} numberOfLines={1}>
                    {d.sub}
                  </Text>
                </View>
                <Text style={ss.dealDisc}>{d.disc}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ── Nearby now (실 POI + 폴백) ── */}
        {/* 상단 여백을 더 줄여(8) 고양이가 딜 카드 하단에 겹쳐 보이게 */}
        <View style={{ paddingTop: 8 }}>
          <View style={{ paddingHorizontal: 16 }}>
            <View style={ss.sectionHead}>
              <Text style={ss.sectionTitle}>{t('home.nearby')}</Text>
              {/* 지렁이 선 + 고양이 + 현재 카드 거리 */}
              <NearbyTrail
                idx={nearbyIdx}
                count={nearbyPois.length}
                km={
                  nearbyPois[nearbyIdx]?.lat != null && nearbyPois[nearbyIdx]?.lng != null
                    ? distKm(
                        coords.latitude,
                        coords.longitude,
                        nearbyPois[nearbyIdx].lat!,
                        nearbyPois[nearbyIdx].lng!,
                      )
                    : null
                }
              />
            </View>
          </View>
          {poisMock && (
            <View style={{ paddingHorizontal: 16, marginTop: -4, marginBottom: 6 }}>
              <FallbackBadge label="Sample" />
            </View>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={32}
            onScroll={(e) =>
              setNearbyIdx(Math.max(0, Math.round(e.nativeEvent.contentOffset.x / (156 + 12))))
            }
            onScrollBeginDrag={() => {
              nearbyDragFromRef.current = nearbyIdx
            }}
            onMomentumScrollEnd={(e) => {
              // 야옹은 사용자 플릭 1회당 1번 — 제스처로 카드가 실제 바뀌었을 때만
              const end = Math.max(0, Math.round(e.nativeEvent.contentOffset.x / (156 + 12)))
              if (end !== nearbyDragFromRef.current) playMeow()
            }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
            {nearbyPois.length > 0
              ? nearbyPois.map((p: Poi) => (
                  <PlaceCard
                    key={p.id}
                    cat={p.cat}
                    name={p.name}
                    sub={p.address ?? 'Busan'}
                    imageUrl={p.imageUrl}
                    extId={p.id}
                    lat={p.lat}
                    lng={p.lng}
                    // 이 장소의 오늘의 딜이 있으면 할인 배지 노출(추천→딜 연결, S-7 — LBS 매칭)
                    badge={dealBadgeFor(p)}
                  />
                ))
              : PLACES.map((p) => (
                  <PlaceCard
                    key={p.id}
                    cat={p.cat}
                    name={p.name}
                    sub={p.sub}
                    rating={p.rating}
                    badge={p.badge}
                    extId={p.id}
                  />
                ))}
          </ScrollView>
        </View>

        {/* ── Recommended courses ── (일반 고객 위치, 크루즈는 딜 위로 이동) */}
        {!isCruise && coursesSection}

        {/* ── From travelers ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 }}>
          <SectionHeader
            title={t('home.travelers')}
            action={t('home.seeAll')}
            onAction={() => router.push('/reviews' as never)}
          />
          <View style={[ss.community, shadows.card]}>
            {REVIEWS.map((r, i) => (
              <View key={r.name} style={[ss.reviewRow, i < REVIEWS.length - 1 && ss.reviewBorder]}>
                <View style={ss.reviewAvatar}>
                  <Text style={ss.reviewAvatarText}>{r.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.reviewName}>
                    {r.name}
                    <Text style={ss.reviewTime}> · {r.time}</Text>
                  </Text>
                  <Text style={ss.reviewText}>{r.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* 플로팅 AI 깐부 버튼 (PLANNING §9, 디자인 docs/AI Gganbu.png) — 알약형 + 로봇 아이콘 + 라벨.
          전체폭 래퍼 + flex-end로 우측 정렬(absolute+right만으로는 전폭 늘어나는 문제 회피).
          탭바 노출 중엔 우측 도킹(아이콘만), 탭바 숨김(스크롤 다운) 시 전체 노출. */}
      <View
        style={[ss.gganbuFabWrap, tabBarHidden && { bottom: 18 + 56 + insets.bottom }]}
        pointerEvents="box-none">
        {/* AI Gganbu — 챗봇 화면 */}
        <DockedFab
          docked={!tabBarHidden}
          onPress={() => router.push('/(tabs)/ai' as never)}
          style={ss.gganbuFab}>
          {/* 외곽선 로봇(눈·안테나 보이도록) — filled면 눈 구멍이 메워져 가독성 저하 */}
          <Icon name="smart_toy" size={23} color="#fff" strokeWidth={2.2} />
          <Text style={ss.gganbuFabText}>Gganbu</Text>
        </DockedFab>
        {/* AI Translate — 음성 통역 실행화면 바로가기(teal=번역 전용) */}
        <DockedFab
          docked={!tabBarHidden}
          onPress={() => router.push('/voice-interpret' as never)}
          style={[ss.gganbuFab, ss.translateFab]}>
          <Icon name="translate" size={20} color="#fff" />
          <Text style={ss.gganbuFabText}>Translate</Text>
        </DockedFab>
      </View>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  row: { flexDirection: 'row', alignItems: 'center' },

  // 플로팅 AI 깐부 버튼 — 알약형 솔리드 블루 + 로봇 아이콘 + 라벨 (docs/AI Gganbu.png)
  gganbuFabWrap: {
    position: 'absolute',
    left: 0,
    right: 16,
    bottom: 18,
    alignItems: 'flex-end', // 알약을 우측 정렬(내용 너비로 shrink)
    gap: 10, // AI Translate / AI Gganbu 세로 스택 간격
  },
  // AI Translate 플로팅 — teal(번역 전용 컬러)
  translateFab: { backgroundColor: '#0D9488' },
  gganbuFab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    paddingLeft: 16,
    paddingRight: 18,
    borderRadius: 999,
    backgroundColor: palette.blue[50],
    ...shadows.blue,
  },
  gganbuFabText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },

  hero: { paddingHorizontal: 18, paddingBottom: 6, overflow: 'hidden' },
  // 히어로 우측 하단 스피커 — 질문·답변 낭독 소리 켜기/끄기(히어로 필들과 동일 톤)
  heroMic: {
    position: 'absolute',
    right: 16,
    bottom: 12,
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.28)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  // 만보기 배지 — 헤더 우상단(알림 옆), 배경 사진 위 가독 확보
  stepsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,23,42,.38)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    height: 32,
  },
  stepsPillText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  stepsPillPts: { color: '#FDE68A', fontSize: 11.5, fontWeight: '800' },
  locationText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: palette.coral[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  iconBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  greeting: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 29,
    minHeight: 44, // gganbuMsg와 동일 높이로 메시지 전환 시 점프 방지
  },
  gganbuMsg: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 25,
    minHeight: 44, // 1~2줄 변동 시 레이아웃 점프 방지
  },
  dateTime: { color: 'rgba(255,255,255,.92)', fontSize: 14, fontWeight: '600', marginTop: 2 },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginBottom: 10,
  },
  weatherText: { color: 'rgba(255,255,255,.92)', fontSize: 13 },
  weatherDot: { color: 'rgba(255,255,255,.5)', fontSize: 13, marginHorizontal: 4 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: palette.zinc[700], padding: 0 },
  translateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.teal[40],
    borderRadius: 12,
    height: 32,
    paddingHorizontal: 10,
  },
  translateBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  coreActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  coreAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.28)',
    backgroundColor: 'rgba(255,255,255,.16)',
    borderRadius: 16,
    paddingTop: 11,
    paddingBottom: 9,
    alignItems: 'center',
    gap: 5,
  },
  coreActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreActionLabel: { fontSize: 12.5, fontWeight: '800', color: '#fff', letterSpacing: -0.1 },
  coreActionSub: { fontSize: 10, color: 'rgba(255,255,255,.92)' },

  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.zinc[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSub: { fontSize: 10.5, color: palette.zinc[400], marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 11, fontWeight: '700', color: palette.blue[50] },

  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 14,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  aiAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiTitle: { fontSize: 14, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.2 },
  aiPrompt: { fontSize: 12, color: palette.zinc[500], marginTop: 2 },
  aiArrow: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: palette.blue[90],
    alignItems: 'center',
    justifyContent: 'center',
  },

  bigTile: { width: 148, borderRadius: 18, overflow: 'hidden', ...shadows.card },
  // flex:1 — 가로 행에서 가장 큰 타일 높이에 맞게 stretch돼도 그라데이션이 끝까지 채움(회색 띠 방지)
  bigTileGrad: {
    flex: 1,
    padding: 12,
    paddingBottom: 14,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  bigTileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bigTileIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigTileBadge: {
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bigTileBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: palette.coral[50],
    letterSpacing: 0.4,
  },
  bigTileTitle: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  bigTileSub: { fontSize: 10.5, color: 'rgba(255,255,255,.94)', marginTop: 1, lineHeight: 14 },

  pickCard: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#fff' },
  pickTrending: {
    position: 'absolute',
    left: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.94)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pickTrendingText: { fontSize: 11, fontWeight: '700', color: palette.coral[50] },
  // 추천 카드 우상단 딜 배지 — 탭하면 쿠폰 QR 직행(추천→쿠폰 전환 동선, S-7)
  pickDealBadge: {
    position: 'absolute',
    right: 12,
    top: 12,
    backgroundColor: palette.coral[50],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pickDealText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  pickScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
    backgroundColor: 'rgba(0,0,0,.45)',
  },
  pickOverlay: { position: 'absolute', left: 14, right: 14, bottom: 10 },
  pickName: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  pickMeta: { color: 'rgba(255,255,255,.94)', fontSize: 11 },
  pickHint: {
    fontSize: 10.5,
    color: palette.zinc[400],
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },

  placeCard: {
    width: 156,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  placeName: { fontSize: 13, fontWeight: '700', color: palette.zinc[900], letterSpacing: -0.1 },
  placeSub: { fontSize: 11, color: palette.zinc[500], marginTop: 1 },
  placeBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  placeRating: { fontSize: 11, fontWeight: '700', color: palette.zinc[800] },

  dealsBanner: {
    borderRadius: 18,
    overflow: 'hidden',
    ...shadows.blue,
    shadowColor: palette.coral[50],
  },
  // 오늘의 딜 슬라이드 카드
  dealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 10,
    borderWidth: 0.5,
    borderColor: '#F1F5F9',
    ...shadows.card,
  },
  pickDistText: { color: palette.blue[50], fontSize: 12.5, fontWeight: '800' },
  dealName: { fontSize: 14, fontWeight: '800', color: palette.zinc[900], marginTop: 4 },
  dealSub: { fontSize: 11.5, color: palette.zinc[500], marginTop: 1 },
  dealDisc: { fontSize: 14, fontWeight: '900', color: palette.coral[50] },
  dealsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
  },
  dealsIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealsTitle: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  dealsSub: { fontSize: 11, color: 'rgba(255,255,255,.94)', marginTop: 2 },
  notchLeft: {
    position: 'absolute',
    left: -6,
    top: '50%',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.zinc[50],
    marginTop: -6,
  },
  notchRight: {
    position: 'absolute',
    right: -6,
    top: '50%',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.zinc[50],
    marginTop: -6,
  },

  courseCard: {
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    padding: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  courseIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseTitle: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: palette.zinc[900],
    letterSpacing: -0.1,
  },
  courseStops: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  courseDot: { width: 7, height: 7, borderRadius: 999, marginRight: 4 },
  courseStop: { fontSize: 11, fontWeight: '600', color: palette.zinc[700] },

  community: {
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    borderRadius: 18,
    padding: 12,
    gap: 12,
  },
  reviewRow: { flexDirection: 'row', gap: 10 },
  reviewBorder: { paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: palette.zinc[200] },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: palette.blue[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  reviewName: { fontSize: 12, fontWeight: '700', color: palette.zinc[900] },
  reviewTime: { color: palette.zinc[400], fontWeight: '500' },
  reviewText: { fontSize: 12, color: palette.zinc[700], marginTop: 3, lineHeight: 17 },
})
