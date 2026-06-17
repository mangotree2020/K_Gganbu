import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, G, Path, Rect } from 'react-native-svg'
import {
  AlertTriangle,
  Bell,
  Bot,
  ChevronRight,
  Compass,
  CreditCard,
  Languages,
  MapPin,
  Navigation,
  Search,
  Ship,
  Sparkles,
  Star,
  Stethoscope,
  Ticket,
  User,
} from 'lucide-react-native'

import { Icon } from '@/components/brand'
import { FallbackBadge } from '@/components/FallbackBadge'
import { useAuthStore } from '@/features/auth/store'
import { usePlaces, type Poi } from '@/features/map/queries'
import { useT } from '@/lib/i18n'

// 색상 토큰
const C = {
  primary: '#0EA5E9',
  primaryDark: '#0284C7',
  primaryDeep: '#0369A1',
  primaryContainer: '#E0F2FE',
  primaryLight: '#BAE6FD',
  coral: '#F97316',
  coralDark: '#EA580C',
  coralContainer: '#FFEDD5',
  teal: '#0D9488',
  tealContainer: '#CCFBF1',
  amber: '#F59E0B',
  cruise: '#1D4ED8',
  cruiseContainer: '#DBEAFE',
  rose: '#E11D48',
  red: '#DC2626',
  z0: '#FFFFFF',
  z50: '#FAFAFA',
  z100: '#F4F4F5',
  z200: '#E4E4E7',
  z300: '#D4D4D8',
  z400: '#A1A1AA',
  z500: '#71717A',
  z700: '#3F3F46',
  z800: '#27272A',
  z900: '#18181B',
} as const

// 장소 데이터
const PLACES = [
  { id: 1, cat: 'seafood', name: 'Mipojeong', sub: 'Seafood · 380m', badge: 'Coupon', rating: 4.8 },
  { id: 2, cat: 'cafe', name: 'Blue Archive', sub: 'Cafe · 520m', badge: '10% off', rating: 4.6 },
  {
    id: 3,
    cat: 'sights',
    name: 'Blueline Park',
    sub: 'Attraction · 1.2km',
    badge: 'Popular',
    rating: 4.9,
  },
  {
    id: 4,
    cat: 'village',
    name: 'Gamcheon Village',
    sub: 'Heritage · 8.2km',
    badge: 'Must-see',
    rating: 4.9,
  },
  {
    id: 5,
    cat: 'beach',
    name: 'Haeundae Beach',
    sub: 'Beach · 200m',
    badge: 'Live cam',
    rating: 4.7,
  },
]

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

const AI_PROMPTS = [
  '6 hours at the port — what now?',
  'Where do locals actually eat near Haeundae?',
  'Rainy afternoon — indoor plan?',
  'Translate this menu for a peanut allergy',
]

// 카테고리별 썸네일 그라데이션 + 아이콘 (디자인 PlaceThumb)
const THUMB: Record<string, { from: string; to: string; icon: string; color: string }> = {
  seafood: { from: '#7DD3FC', to: '#0284C7', icon: 'set_meal', color: '#fff' },
  cafe: { from: '#FEF3C7', to: '#F59E0B', icon: 'local_cafe', color: '#78350F' },
  sights: { from: '#CCFBF1', to: '#2DD4BF', icon: 'photo_camera', color: '#115E59' },
  village: { from: '#FDBA74', to: '#F97316', icon: 'holiday_village', color: '#fff' },
  beach: { from: '#BAE6FD', to: '#0EA5E9', icon: 'beach_access', color: '#0C4A6E' },
  cable: { from: '#E0F2FE', to: '#38BDF8', icon: 'aerial_way', color: '#0C4A6E' },
  spa: { from: '#FCE7F3', to: '#EC4899', icon: 'spa', color: '#831843' },
}

// 뱃지 색상
const BADGE_COLORS: Record<string, string> = {
  Coupon: C.coral,
  '10% off': C.amber,
  Popular: C.primary,
  'Must-see': C.primary,
  'Live cam': C.teal,
}

// 퀵 액세스 타일 설정
const QUICK_TILES = [
  {
    id: 'translate',
    title: 'Translate',
    sub: 'Camera · Voice',
    from: '#5EEAD4',
    to: '#0D9488',
    icon: 'Languages',
  },
  {
    id: 'coupons',
    title: 'Coupons',
    sub: '24 near Haeundae',
    from: '#FDBA74',
    to: '#F97316',
    icon: 'Ticket',
    badge: 'HOT',
  },
  {
    id: 'cruise',
    title: 'Cruise Mode',
    sub: 'Tap for itinerary',
    from: '#60A5FA',
    to: '#1D4ED8',
    icon: 'Ship',
  },
  {
    id: 'allergy',
    title: 'Allergy card',
    sub: 'Show in 한국어',
    from: '#FDA4AF',
    to: '#E11D48',
    icon: 'Stethoscope',
  },
  {
    id: 'payment',
    title: 'Payment tips',
    sub: 'Card · T-Money',
    from: '#7DD3FC',
    to: '#0284C7',
    icon: 'CreditCard',
  },
  {
    id: 'emergency',
    title: 'Emergency',
    sub: '119 · 1330',
    from: '#F87171',
    to: '#DC2626',
    icon: 'AlertTriangle',
  },
]

// 3대 핵심 액션 (Translate Now / Ask AI Gganbu / Find Places)
const CORE_ACTIONS = [
  {
    key: 'translate',
    labelKey: 'home.translateNow',
    subKey: 'home.translateNowSub',
    route: '/translate',
    icon: <Languages size={22} color="#0284C7" />,
  },
  {
    key: 'ai',
    labelKey: 'home.askAi',
    subKey: 'home.askAiSub',
    route: '/(tabs)/ai',
    icon: <Bot size={22} color="#0284C7" />,
  },
  {
    key: 'map',
    labelKey: 'home.findPlaces',
    subKey: 'home.findPlacesSub',
    route: '/(tabs)/map',
    icon: <Compass size={22} color="#0284C7" />,
  },
]

const QUICK_ICON_MAP: Record<string, React.ReactNode> = {
  Languages: <Languages size={18} color="#fff" />,
  Ticket: <Ticket size={18} color="#fff" />,
  Ship: <Ship size={18} color="#fff" />,
  Stethoscope: <Stethoscope size={18} color="#fff" />,
  CreditCard: <CreditCard size={18} color="#fff" />,
  AlertTriangle: <AlertTriangle size={18} color="#fff" />,
}

// 도시 실루엣 SVG
function CitySilhouette() {
  return (
    <Svg
      viewBox="0 0 380 200"
      preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
      opacity={0.35}>
      <Circle cx={300} cy={60} r={44} fill="rgba(255,255,255,.35)" />
      <Circle cx={300} cy={60} r={28} fill="rgba(255,255,255,.5)" />
      <Path
        d="M0 170 L60 120 L110 155 L160 100 L220 140 L290 85 L380 130 L380 200 L0 200 Z"
        fill="rgba(15,23,42,.18)"
      />
      <Path
        d="M0 185 L40 152 L90 172 L150 138 L200 162 L260 132 L320 155 L380 138 L380 200 L0 200 Z"
        fill="rgba(15,23,42,.28)"
      />
      <G fill="rgba(15,23,42,.42)">
        <Rect x={40} y={152} width={12} height={48} />
        <Rect x={60} y={163} width={18} height={37} />
        <Rect x={86} y={138} width={9} height={62} />
        <Rect x={100} y={155} width={14} height={45} />
        <Rect x={140} y={145} width={11} height={55} />
        <Rect x={160} y={160} width={17} height={40} />
        <Rect x={200} y={133} width={10} height={67} />
        <Rect x={216} y={155} width={16} height={45} />
        <Rect x={252} y={150} width={12} height={50} />
        <Rect x={272} y={138} width={9} height={62} />
        <Rect x={294} y={155} width={16} height={45} />
        <Rect x={320} y={145} width={12} height={55} />
        <Rect x={340} y={160} width={18} height={40} />
      </G>
    </Svg>
  )
}

// 장소 썸네일 (그라데이션 + 카테고리 아이콘)
function PlaceThumb({ category, height = 92 }: { category: string; height?: number }) {
  const t = THUMB[category] ?? THUMB.sights
  return (
    <LinearGradient
      colors={[t.from, t.to]}
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
      <Icon name={t.icon} size={Math.floor(height * 0.42)} color={t.color} filled />
    </LinearGradient>
  )
}

// 섹션 헤더
function SectionHeader({
  title,
  sub,
  action,
  badge,
}: {
  title?: string
  sub?: string
  action?: string
  badge?: React.ReactNode
}) {
  return (
    <View style={ss.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View>
          {title && <Text style={ss.sectionTitle}>{title}</Text>}
          {sub && <Text style={ss.sectionSub}>{sub}</Text>}
        </View>
        {badge}
      </View>
      {action && (
        <Pressable style={ss.sectionAction}>
          <Text style={ss.sectionActionText}>{action}</Text>
          <ChevronRight size={14} color={C.primary} />
        </Pressable>
      )}
    </View>
  )
}

// AI 메이트 카드
function AiMateCard({ promptIdx }: { promptIdx: number }) {
  return (
    <Pressable
      style={({ pressed }) => [ss.aiCard, ss.shadow, { opacity: pressed ? 0.94 : 1 }]}
      onPress={() => router.push('/(tabs)/ai')}>
      <LinearGradient
        colors={['#38BDF8', '#0EA5E9', '#0D9488']}
        locations={[0, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={ss.aiAvatar}>
        <Sparkles size={24} color="#fff" />
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={ss.aiTitle}>Ask AI Mate anything</Text>
        <Text style={ss.aiPrompt}>&quot;{AI_PROMPTS[promptIdx]}&quot;</Text>
      </View>
      <View style={ss.aiArrow}>
        <Navigation size={18} color={C.primaryDeep} />
      </View>
    </Pressable>
  )
}

// 퀵 액세스 타일 → 라우트 매핑
const TILE_ROUTE: Record<string, string> = {
  translate: '/translate',
  coupons: '/(tabs)/coupons',
  cruise: '/cruise',
  allergy: '/allergy',
  payment: '/tips',
  emergency: '/emergency',
}

// 퀵 액세스 BigTile
function BigTile({ tile }: { tile: (typeof QUICK_TILES)[0] }) {
  return (
    <Pressable
      style={({ pressed }) => [ss.bigTile, { opacity: pressed ? 0.88 : 1 }]}
      onPress={() => router.push(TILE_ROUTE[tile.id] as never)}>
      <LinearGradient
        colors={[tile.from, tile.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={ss.bigTileGrad}>
        <View style={ss.bigTileTop}>
          <View style={ss.bigTileIconBox}>{QUICK_ICON_MAP[tile.icon]}</View>
          {tile.badge && (
            <View style={ss.bigTileBadge}>
              <Text style={ss.bigTileBadgeText}>{tile.badge}</Text>
            </View>
          )}
        </View>
        <View>
          <Text style={ss.bigTileTitle}>{tile.title}</Text>
          <Text style={ss.bigTileSub}>{tile.sub}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  )
}

// Today's pick 카드
function TodayPickCard() {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/place',
          params: {
            cat: 'village',
            name: 'Gamcheon Culture Village',
            sub: 'Heritage · 8.2km',
            badge: 'Must-see',
            rating: '4.9',
            dist: '8.2km',
            desc: "Pastel houses climbing the hillside — Busan's open-air color palette. Get the stamp-tour map at the info center.",
          },
        })
      }
      style={({ pressed }) => [ss.pickCard, ss.shadowCard, { opacity: pressed ? 0.92 : 1 }]}>
      <View style={{ height: 180 }}>
        <PlaceThumb category="village" height={180} />
        {/* 트렌딩 뱃지 */}
        <View style={ss.pickTrendingBadge}>
          <Text style={ss.pickTrendingText}>🔥 Trending</Text>
        </View>
        {/* 하단 스크림 */}
        <View style={ss.pickScrim} />
        {/* 텍스트 오버레이 */}
        <View style={ss.pickOverlay}>
          <Text style={ss.pickName}>Gamcheon Culture Village</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <View style={ss.row}>
              <Star size={12} color={C.amber} fill={C.amber} />
              <Text style={ss.pickMeta}> 4.9 · 18k reviews</Text>
            </View>
            <Text style={ss.pickMeta}>· 🚶 8.2km</Text>
          </View>
        </View>
      </View>
    </Pressable>
  )
}

// 장소 카드 (Nearby now)
function PlaceCard({ place }: { place: (typeof PLACES)[0] }) {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/place',
          params: {
            cat: place.cat,
            name: place.name,
            sub: place.sub,
            badge: place.badge,
            rating: String(place.rating),
          },
        })
      }
      style={({ pressed }) => [ss.placeCard, ss.shadowCard, { opacity: pressed ? 0.88 : 1 }]}>
      <PlaceThumb category={place.cat} height={92} />
      <View style={ss.placeCardBody}>
        <Text style={ss.placeCardName} numberOfLines={1}>
          {place.name}
        </Text>
        <Text style={ss.placeCardSub}>{place.sub}</Text>
        <View style={ss.placeCardBottom}>
          <View style={ss.row}>
            <Star size={12} color={C.amber} fill={C.amber} />
            <Text style={ss.placeCardRating}> {place.rating}</Text>
          </View>
          {place.badge && (
            <View style={[ss.badge, { backgroundColor: BADGE_COLORS[place.badge] ?? C.primary }]}>
              <Text style={ss.badgeText}>{place.badge}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  )
}

// 실데이터 POI 카드 (TourAPI)
function PoiCard({ poi }: { poi: Poi }) {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/place',
          params: { cat: poi.cat, name: poi.name, sub: poi.address ?? 'Busan', dist: '' },
        })
      }
      style={({ pressed }) => [ss.placeCard, ss.shadowCard, { opacity: pressed ? 0.88 : 1 }]}>
      {poi.imageUrl ? (
        <Image
          source={{ uri: poi.imageUrl }}
          style={{ height: 92, width: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <PlaceThumb category={poi.cat} height={92} />
      )}
      <View style={ss.placeCardBody}>
        <Text style={ss.placeCardName} numberOfLines={1}>
          {poi.name}
        </Text>
        <Text style={ss.placeCardSub} numberOfLines={1}>
          {poi.address ?? 'Busan'}
        </Text>
      </View>
    </Pressable>
  )
}

// 딜 배너 (티켓 스타일)
function DealsBanner() {
  return (
    <Pressable style={({ pressed }) => [ss.dealsBanner, { opacity: pressed ? 0.9 : 1 }]}>
      {/* 왼쪽 노치 */}
      <View style={ss.dealsNotchLeft} />
      {/* 오른쪽 노치 */}
      <View style={ss.dealsNotchRight} />
      <View style={ss.dealsInner}>
        <View style={ss.dealsIconBox}>
          <Ticket size={26} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ss.dealsTitle}>Mipojeong 10% · ends in 5h</Text>
          <Text style={ss.dealsSub}>+23 more coupons within 1km — nearest 380m</Text>
        </View>
        <ChevronRight size={20} color="#fff" />
      </View>
    </Pressable>
  )
}

// 코스 카드
function CourseCard({ course }: { course: (typeof COURSES)[0] }) {
  const accentColor = course.isCruise ? C.cruise : C.primary
  const containerColor = course.isCruise ? C.cruiseContainer : C.primaryContainer
  return (
    <Pressable
      style={({ pressed }) => [ss.courseCard, ss.shadowCard, { opacity: pressed ? 0.88 : 1 }]}>
      <View style={ss.courseCardInner}>
        <View style={ss.courseRow}>
          <View style={[ss.courseIconBox, { backgroundColor: containerColor }]}>
            {course.isCruise ? (
              <Ship size={16} color={accentColor} />
            ) : (
              <Navigation size={16} color={accentColor} />
            )}
          </View>
          <Text style={ss.courseTitle}>{course.title}</Text>
          <View style={[ss.coursePill, { backgroundColor: containerColor }]}>
            <Text style={[ss.coursePillText, { color: accentColor }]}>{course.tag}</Text>
          </View>
        </View>
        <View style={ss.courseStops}>
          {course.stops.map((stop, i) => (
            <View key={stop} style={ss.row}>
              <View style={[ss.courseDot, { backgroundColor: accentColor }]} />
              <Text style={ss.courseStop}>{stop}</Text>
              {i < course.stops.length - 1 && (
                <ChevronRight size={12} color={C.z300} style={{ marginHorizontal: 2 }} />
              )}
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  )
}

// 커뮤니티 카드
const REVIEWS = [
  {
    name: 'Yuki · 🇯🇵',
    text: 'Mipojeong gukbap is everything. Got the 10% coupon — easy.',
    time: '2h',
  },
  {
    name: 'Alex · 🇺🇸',
    text: 'Translate camera saved me from a pork dish — peanut allergy section is excellent.',
    time: '5h',
  },
]

function CommunityCard() {
  return (
    <View style={[ss.communityCard, ss.shadowCard]}>
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
  )
}

export default function HomeScreen() {
  useAuthStore((state) => state.user)
  const t = useT()
  const [promptIdx, setPromptIdx] = useState(0)
  const { data: placesData } = usePlaces('en', 12)
  const pois = placesData?.pois
  const poisMock = placesData?.provider === 'mock'

  useEffect(() => {
    const t = setInterval(() => setPromptIdx((i) => (i + 1) % AI_PROMPTS.length), 3500)
    return () => clearInterval(t)
  }, [])

  return (
    <View style={ss.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.scrollContent}>
        {/* ─── 헤더 ─── */}
        <LinearGradient
          colors={['#FDBA74', '#38BDF8', '#0EA5E9']}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.3, y: 1 }}
          style={ss.header}>
          <CitySilhouette />
          {/* 상단 행: 위치 + 아이콘 */}
          <SafeAreaView edges={['top']}>
            <View style={ss.headerTop}>
              <Pressable style={ss.locationPill}>
                <MapPin size={12} color="#fff" fill="#fff" />
                <Text style={ss.locationText}>Haeundae, Busan</Text>
              </Pressable>
              <View style={ss.headerIcons}>
                <Pressable style={ss.iconBtn}>
                  <Bell size={18} color="#fff" fill="transparent" />
                  <View style={ss.iconBadge}>
                    <Text style={ss.iconBadgeText}>3</Text>
                  </View>
                </Pressable>
                <Pressable style={ss.iconBtn}>
                  <User size={18} color="#fff" />
                </Pressable>
              </View>
            </View>

            {/* 인사말 */}
            <View style={ss.greetingRow}>
              <Text style={ss.greetingMain}>Good morning,</Text>
              <Text style={ss.greetingSub}>{"let's go ☀️"}</Text>
            </View>
            <View style={ss.weatherRow}>
              <Text style={ss.weatherText}>19° clear</Text>
              <Text style={ss.weatherDot}>·</Text>
              <Text style={ss.weatherText}>Wave 0.6m</Text>
            </View>

            {/* 검색 바 */}
            <View style={ss.searchBar}>
              <Search size={20} color={C.primaryDeep} />
              <TextInput
                placeholder="Try 'best seafood near me'"
                placeholderTextColor={C.z500}
                style={ss.searchInput}
              />
              <Pressable style={ss.translateBtn} onPress={() => router.push('/translate')}>
                <Languages size={14} color="#fff" />
                <Text style={ss.translateBtnText}> KO</Text>
              </Pressable>
            </View>

            {/* 3대 핵심 액션 (spec §7) */}
            <View style={ss.coreActions}>
              {CORE_ACTIONS.map((a) => (
                <Pressable
                  key={a.key}
                  style={({ pressed }) => [ss.coreAction, { opacity: pressed ? 0.85 : 1 }]}
                  onPress={() => a.route && router.push(a.route as never)}>
                  <View style={ss.coreActionIcon}>{a.icon}</View>
                  <Text style={ss.coreActionLabel}>{t(a.labelKey)}</Text>
                  <Text style={ss.coreActionSub}>{t(a.subKey)}</Text>
                </Pressable>
              ))}
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* ─── AI Mate 카드 ─── */}
        <View style={ss.section}>
          <AiMateCard promptIdx={promptIdx} />
        </View>

        {/* ─── 퀵 액세스 슬라이더 ─── */}
        <View style={{ paddingTop: 20 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {QUICK_TILES.map((tile) => (
              <BigTile key={tile.id} tile={tile} />
            ))}
          </ScrollView>
        </View>

        {/* ─── Today's pick ─── */}
        <View style={[ss.section, { paddingTop: 22 }]}>
          <SectionHeader title="Today's pick" sub="Curated by AI Mate" />
          <TodayPickCard />
        </View>

        {/* ─── Nearby now (TourAPI 실데이터) ─── */}
        <View style={{ paddingTop: 22 }}>
          <SectionHeader
            title="Nearby now"
            action="See all"
            badge={poisMock ? <FallbackBadge label="Sample" /> : undefined}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingTop: 8 }}>
            {pois && pois.length > 0
              ? pois.map((p) => <PoiCard key={p.id} poi={p} />)
              : PLACES.map((p) => <PlaceCard key={p.id} place={p} />)}
          </ScrollView>
        </View>

        {/* ─── Today's deals ─── */}
        <View style={[ss.section, { paddingTop: 22 }]}>
          <SectionHeader title="Today's deals" action="See all" />
          <DealsBanner />
        </View>

        {/* ─── 추천 코스 ─── */}
        <View style={[ss.section, { paddingTop: 22 }]}>
          <SectionHeader title="Recommended courses" action="See all" />
          <View style={{ gap: 10 }}>
            {COURSES.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </View>
        </View>

        {/* ─── 여행자 후기 ─── */}
        <View style={[ss.section, { paddingTop: 22, paddingBottom: 32 }]}>
          <SectionHeader title="From travelers" action="See all" />
          <CommunityCard />
        </View>
      </ScrollView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.z50 },
  scrollContent: {},
  row: { flexDirection: 'row', alignItems: 'center' },

  // 헤더
  header: {
    backgroundColor: C.primary,
    paddingHorizontal: 18,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 14,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.28)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  locationText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  headerIcons: { flexDirection: 'row', gap: 8 },
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
    borderRadius: 999,
    backgroundColor: C.coral,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  iconBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  greetingRow: { marginBottom: 2 },
  greetingMain: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  greetingSub: { color: 'rgba(255,255,255,.9)', fontSize: 22, fontWeight: '700' },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 14,
  },
  weatherText: { color: 'rgba(255,255,255,.92)', fontSize: 13 },
  weatherDot: { color: 'rgba(255,255,255,.5)', fontSize: 13 },

  // 검색 바
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.z700,
    paddingVertical: 0,
  },
  translateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.teal,
    borderRadius: 12,
    height: 32,
    paddingHorizontal: 10,
  },
  translateBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // 3대 핵심 액션
  coreActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  coreAction: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.28)',
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
  coreActionSub: { fontSize: 10, color: 'rgba(255,255,255,.92)', marginTop: -3 },

  // 섹션
  section: { paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.z500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSub: { fontSize: 10.5, color: C.z400, marginTop: 1 },
  sectionAction: { flexDirection: 'row', alignItems: 'center' },
  sectionActionText: { fontSize: 11, fontWeight: '700', color: C.primary },

  // 그림자
  shadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  shadowCard: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // AI 메이트 카드
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 14,
    borderWidth: 0.5,
    borderColor: C.z200,
    marginTop: 20,
  },
  aiAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 4,
  },
  aiTitle: { fontSize: 14, fontWeight: '800', color: C.z900, letterSpacing: -0.2 },
  aiPrompt: { fontSize: 12, color: C.z500, marginTop: 2 },
  aiArrow: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: C.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // BigTile
  bigTile: {
    width: 148,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
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
  bigTileIconBox: {
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
  bigTileBadgeText: { fontSize: 9, fontWeight: '800', color: C.coral, letterSpacing: 0.4 },
  bigTileTitle: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  bigTileSub: { fontSize: 10.5, color: 'rgba(255,255,255,.94)', marginTop: 1, lineHeight: 14 },

  // Today's pick
  pickCard: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  pickTrendingBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,.94)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pickTrendingText: { fontSize: 11, fontWeight: '700', color: C.coral },
  pickScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
    backgroundColor: 'rgba(0,0,0,.45)',
  },
  pickOverlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 10,
  },
  pickName: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  pickMeta: { color: 'rgba(255,255,255,.94)', fontSize: 11 },

  // 장소 카드
  placeCard: {
    width: 156,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: C.z200,
  },
  placeCardBody: { padding: 8, paddingTop: 8, paddingBottom: 10 },
  placeCardName: { fontSize: 13, fontWeight: '700', color: C.z900, letterSpacing: -0.1 },
  placeCardSub: { fontSize: 11, color: C.z500, marginTop: 1 },
  placeCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  placeCardRating: { fontSize: 11, fontWeight: '700', color: C.z800 },
  badge: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  // 딜 배너
  dealsBanner: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: C.coral,
    shadowColor: C.coral,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 6,
  },
  dealsNotchLeft: {
    position: 'absolute',
    left: -6,
    top: '50%',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.z50,
    zIndex: 1,
    marginTop: -6,
  },
  dealsNotchRight: {
    position: 'absolute',
    right: -6,
    top: '50%',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.z50,
    zIndex: 1,
    marginTop: -6,
  },
  dealsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
  },
  dealsIconBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealsTitle: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  dealsSub: { fontSize: 11, color: 'rgba(255,255,255,.94)', marginTop: 2 },

  // 코스 카드
  courseCard: {
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: C.z200,
    overflow: 'hidden',
  },
  courseCardInner: { padding: 12, paddingHorizontal: 14, gap: 8 },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  courseIconBox: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseTitle: { flex: 1, fontSize: 13.5, fontWeight: '700', color: C.z900, letterSpacing: -0.1 },
  coursePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  coursePillText: { fontSize: 11, fontWeight: '700' },
  courseStops: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 },
  courseDot: { width: 7, height: 7, borderRadius: 999, marginRight: 4 },
  courseStop: { fontSize: 11, fontWeight: '600', color: C.z700 },

  // 커뮤니티
  communityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: C.z200,
    padding: 12,
    gap: 12,
  },
  reviewRow: { flexDirection: 'row', gap: 10 },
  reviewBorder: { paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: C.z200 },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reviewAvatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  reviewName: { fontSize: 12, fontWeight: '700', color: C.z900 },
  reviewTime: { color: C.z400, fontWeight: '500' },
  reviewText: { fontSize: 12, color: C.z700, marginTop: 3, lineHeight: 17 },
})
