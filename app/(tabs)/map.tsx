import * as Location from 'expo-location'
import { router, useIsFocused, useLocalSearchParams } from 'expo-router'
import Slider from '@react-native-community/slider'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector, ScrollView as GHScrollView } from 'react-native-gesture-handler'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { CachedImage } from '@/components/CachedImage'
import { FallbackBadge } from '@/components/FallbackBadge'
import { PlaceThumb } from '@/components/PlaceThumb'
import { track } from '@/features/analytics/service'
import { useRequireAccount } from '@/features/auth/loginPrompt'
import { matchDeal } from '@/features/coupon/matchDeal'
import { useJourneyTracker } from '@/features/journey/tracker'
import { useCoupons } from '@/features/coupon/queries'
import { useFavorites, useToggleFavorite } from '@/features/favorites/queries'
import { GoogleMap, type GoogleMapHandle } from '@/features/map/GoogleMap'
import {
  fetchRoute,
  useMapPoisMulti,
  lookupPlace,
  useNaverSearch,
  type LatLng,
  type NaverPoi,
  type Poi,
} from '@/features/map/queries'
import {
  NaverMap,
  type MapType,
  type NaverMapHandle,
  type NaverMarker,
} from '@/features/map/NaverMap'
import { PlaceReviewsSection } from '@/features/review/PlaceReviewsSection'
import { useStampCards } from '@/features/stamp/queries'
import { getTickets, type Ticket } from '@/features/ticket/services'
import { useCurrentLocation } from '@/hooks/useCurrentLocation'
import { useTabBarAutoHide, useTabBarStore } from '@/hooks/useTabBarAutoHide'
import { useLocaleStore, useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

// 도보 사용자 기준 줌 — 골목·건물이 구분되는 축척(≈100m 스케일).
// 검색/내 위치/장소 선택 시 공통 사용. Naver·Google 모두 동일 zoom 체계라 두 지도 축척이 일치한다
// (각 WebView HTML의 초기 zoom 값도 동일하게 맞춰둘 것 — NaverMap.tsx / GoogleMap.tsx)
const WALK_ZOOM = 17

// 하단 시트 스냅 높이 — MINI(헤드만), HALF(헤드+카드 절반=초기), FULL(콘텐츠 다수)
// Blend 바가 시트 상단에 상주(grabber 대체)하므로 바 높이만큼만 여유를 더한다
const SHEET_MINI = 152
const SHEET_HALF = 248 // 헤드 + 가로 추천카드 절반 정도 보임
// FULL 높이는 화면 크기에서 계산한다(지도 상단 검색바까지 덮는 거의 전체 화면) — 컴포넌트 내부 sheetFullH

// 카테고리 필터 — 네이버/구글 지도 수준의 다양한 분류(TourAPI 콘텐츠 타입 기반)
const CATS: { key: string; labelKey: string; icon: string; color: string }[] = [
  { key: 'food', labelKey: 'map.catFood', icon: 'restaurant', color: palette.coral[50] },
  { key: 'sights', labelKey: 'map.catSights', icon: 'photo_camera', color: palette.teal[40] },
  { key: 'culture', labelKey: 'map.catCulture', icon: 'festival', color: palette.amber[50] },
  { key: 'stay', labelKey: 'map.catStay', icon: 'hotel', color: palette.blue[50] },
  { key: 'shopping', labelKey: 'map.catShopping', icon: 'shopping_bag', color: palette.rose[40] },
  {
    key: 'leisure',
    labelKey: 'map.catLeisure',
    icon: 'directions_walk',
    color: palette.success[50],
  },
  { key: 'festival', labelKey: 'map.catFestival', icon: 'celebration', color: palette.violet[40] },
  { key: 'course', labelKey: 'map.catCourse', icon: 'route', color: palette.indigo[40] },
]
// 카테고리 키 → 현지화 라벨(없으면 키 그대로).
// 'stamp'은 필터 칩이 아니라 스탬프 매장 레이어(REQ-ST-2) 전용 카테고리라 별도 매핑.
const catLabel = (t: (k: string) => string, cat: string): string => {
  if (cat === 'stamp') return t('stamp.title')
  const c = CATS.find((x) => x.key === cat)
  return c ? t(c.labelKey) : cat
}

// 카테고리 → TourAPI contentTypeId (Kor/외국어 서비스가 ID가 달라 분기). 필터 시 해당 타입만 조회.
const CAT_CONTENT_TYPE: Record<string, { ko: string; foreign: string }> = {
  sights: { ko: '12', foreign: '76' },
  culture: { ko: '14', foreign: '78' },
  festival: { ko: '15', foreign: '85' },
  course: { ko: '25', foreign: '77' },
  leisure: { ko: '28', foreign: '75' },
  stay: { ko: '32', foreign: '80' },
  shopping: { ko: '38', foreign: '79' },
  food: { ko: '39', foreign: '82' },
}
const contentTypeFor = (cat: string | null, lang: string): string | undefined => {
  if (!cat) return undefined
  const m = CAT_CONTENT_TYPE[cat]
  return m ? (lang === 'ko' ? m.ko : m.foreign) : undefined
}

// 지도 유형 순환 + 아이콘
const MAP_TYPES: MapType[] = ['normal', 'satellite', 'hybrid']
const MAP_TYPE_ICON: Record<MapType, string> = {
  normal: 'map',
  satellite: 'layers',
  hybrid: 'layers',
}

// 리뷰는 선택 장소별 실데이터(Google Places, 언어별 분리)로 usePlaceReviews에서 조회.
// 키 미설정/실패 시 queries.ts의 MOCK_REVIEWS 폴백(mock-first).

// 두 좌표 간 거리(m) — Haversine. 관광지 카드 거리순 정렬·표시용.
function distanceM(a: LatLng, b: { lat: number; lng: number }): number {
  const R = 6371000
  const dLat = ((b.lat - a.latitude) * Math.PI) / 180
  const dLng = ((b.lng - a.longitude) * Math.PI) / 180
  const la1 = (a.latitude * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
const fmtDistance = (m: number) => (m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`)

// 카테고리 → 마커 색
const CAT_COLOR: Record<string, string> = {
  food: palette.coral[50],
  sights: palette.teal[40],
  culture: palette.amber[50],
  stay: palette.blue[50],
  shopping: palette.rose[40],
  leisure: palette.success[50],
  festival: palette.violet[40],
  course: palette.indigo[40],
  // 구 카테고리/폴백
  seafood: palette.coral[50],
  cafe: palette.amber[50],
  village: palette.cruise.base,
  beach: palette.blue[50],
  stamp: palette.amber[50], // 스탬프 매장(REQ-ST-2)
}
const catColor = (cat: string) => CAT_COLOR[cat] ?? palette.blue[50]

// 카테고리 → 마커 글리프(이모지) — 검색 필터 아이콘과 동일한 성격 구분을 지도 마커에도 반영
const CAT_GLYPH: Record<string, string> = {
  food: '🍴',
  seafood: '🐟',
  cafe: '☕',
  sights: '📷',
  culture: '🎭',
  stay: '🛏',
  shopping: '🛍',
  leisure: '⚽',
  festival: '🎉',
  course: '🧭',
  beach: '⛱',
  village: '🏘',
  stamp: '🔖',
}
const catGlyph = (cat: string) => CAT_GLYPH[cat] ?? '📍'

// 개별 리뷰 행 — 리뷰 언어가 앱 언어와 다르면 출발 국기(예: 🇰🇷)를 표시하고,
// 국기를 탭하면 앱 언어로 번역 + 국기를 앱 언어 국기로 교체. 미번역 외국어 리뷰의 국기는
// 화면에 보일 때 탭 유도를 위해 브르르 떨린다(주기적 wiggle).
export default function MapScreen() {
  const t = useT()
  // 시트 리뷰 영역 스크롤 시 X식 하단 탭바 자동 숨김/표시
  const tabBarAutoHide = useTabBarAutoHide()
  const lang = useLocaleStore((s) => s.lang) // 지도 라벨·POI 언어
  // Blend 상시 — 슬라이더 0 = Naver 완전 표시(좌) ~ 1 = Google 완전 표시(우).
  // 양끝 도달 시 해당 지도 버튼이 네온으로 깜빡여 현재 상태를 알린다(별도 선택바 없음).
  const [blendPos, setBlendPos] = useState(0.5)
  // 슬라이더 양끝(완전 Naver/완전 Google) 도달 시 해당 버튼 네온 테두리 깜빡임
  const neonPulse = useState(() => new Animated.Value(1))[0]
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(neonPulse, { toValue: 0.15, duration: 550, useNativeDriver: true }),
        Animated.timing(neonPulse, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [neonPulse])
  const naverFull = blendPos <= 0.03
  const googleFull = blendPos >= 0.97
  // 지도 첫 진입 시 Blend 1회 자동 시연 — Naver(0)→Google(1) 스윕 후 Google에서 정지.
  // Blend는 바만 봐서는 발견이 어려운 고유 기능이라 로딩 직후 투명도 변화를 직접 보여준다.
  // 사용자가 슬라이더를 잡으면(onSlidingStart) 즉시 중단.
  const demoDoneRef = useRef(false)
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelBlendDemo = () => {
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current)
      demoTimerRef.current = null
    }
  }
  const startBlendDemo = () => {
    if (demoDoneRef.current) return
    demoDoneRef.current = true
    const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)
    const t0 = Date.now()
    setBlendPos(0)
    demoTimerRef.current = setInterval(() => {
      const el = Date.now() - t0
      if (el < 600)
        setBlendPos(0) // 완전 Naver 잠시 유지
      else if (el < 2400)
        setBlendPos(ease((el - 600) / 1800)) // Naver→Google 스윕
      else {
        setBlendPos(1) // 완전 Google에서 정지 (중앙 복귀 없음)
        cancelBlendDemo()
      }
    }, 40)
  }
  useEffect(() => cancelBlendDemo, [])
  // Blend 마커 레이어 토글 — 슬라이더 바의 Naver/Google 버튼으로 각 지도 마커 표시 제어
  const [naverMarkersOn, setNaverMarkersOn] = useState(true)
  const [googleMarkersOn, setGoogleMarkersOn] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  // 베이스맵 POI 탭으로 선택된 임시 장소(우리 마커 목록 밖) — place-lookup 결과
  const [tapped, setTapped] = useState<Poi | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [routeInfo, setRouteInfo] = useState<{
    distance: number
    duration: number
    mock: boolean
  } | null>(null)
  const [routing, setRouting] = useState(false)
  // 길찾기 중 내 위치 마커 실시간 갱신(4초/5m) + 이동 경로 기록(REQ-LOC-1·2)
  const journey = useJourneyTracker((lat, lng) => {
    naverRef.current?.setMyLocation(lat, lng)
    googleRef.current?.setMyLocation(lat, lng)
  })

  // 검색 (Naver 지역검색 → 결과로 지도 이동)
  const [searchQuery, setSearchQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const { data: searchResults, isFetching: searching } = useNaverSearch(
    submittedQuery,
    submittedQuery.length > 0,
  )
  // 카테고리 필터 (null = 전체, 단일 선택 → 해당 카테고리만 재조회)
  const [showFilter, setShowFilter] = useState(false)
  const [catFilter, setCatFilter] = useState<string[]>([]) // 다중 선택(빈 배열 = 전체)
  // 지도 유형 (일반/위성/하이브리드)
  const [mapType, setMapTypeState] = useState<MapType>('normal')
  // 하단 시트 높이 — 초기 HALF(카드 절반 보임). sheetBaseRef는 현재 스냅 추적.
  const sheetH = useState(() => new Animated.Value(SHEET_HALF))[0]
  const sheetBaseRef = useRef(SHEET_HALF)
  // 최대 확장 = 지도 상단 검색바까지 덮는 높이(상태바만 남김). 화면 높이에서 계산
  const { height: winH } = useWindowDimensions()
  // 시트가 최대(FULL)인지 — 이때만 리뷰 목록을 스크롤한다(그 전엔 스와이프 = 시트 확장).
  // 제스처 콜백에서 최신값을 읽어야 해 ref를 함께 둔다.
  const [sheetFull, setSheetFull] = useState(false)
  const sheetFullRef = useRef(false)
  const markFull = (v: boolean) => {
    sheetFullRef.current = v
    setSheetFull(v)
  }
  // 탭바 자동 숨김 보정 — 탭바가 접히며 생긴 여백을 지도(flex:1)가 가져가면 시트 상단이
  // 내려앉아 리뷰 영역이 줄어 보인다. 같은 높이를 시트에 더해 시트 상단 위치를 유지한다.
  // (몰입 모드는 시트를 0으로 접는 상태라 보정하지 않음)
  const insets = useSafeAreaInsets()
  const tabBarH = 56 + insets.bottom // (tabs)/_layout.tsx의 barH와 동일
  const tabHidden = useTabBarStore((s) => s.hidden)
  const tabPad = useState(() => new Animated.Value(0))[0]
  // 최대 확장 높이 — 지도 검색 영역까지 덮되 폰 상태표시줄(insets.top)은 남긴다.
  // 실제 컨테이너 높이를 onLayout으로 측정해 쓰고, 측정 전에는 화면 크기로 근사한다.
  const [colH, setColH] = useState(0)
  const sheetFullH = Math.max(SHEET_HALF + 120, Math.round((colH || winH - tabBarH) - insets.top))
  const sheetSnaps = useMemo(() => [SHEET_MINI, SHEET_HALF, sheetFullH], [sheetFullH])

  // 몰입(전체 화면) 모드 — 시설 없는 빈 지면 탭으로 켜고, 몰입 중 아무 지점 탭으로 즉시 복귀.
  // 켜지면 검색바·Blend 바·FAB·하단 시트·탭바를 모두 숨겨 지도만 보인다.
  const [immersive, setImmersive] = useState(false)
  const immersiveRef = useRef(false)
  const setTabHidden = useTabBarStore((s) => s.setHidden)
  const setImmersiveMode = (on: boolean) => {
    if (immersiveRef.current === on) return
    immersiveRef.current = on
    setImmersive(on)
    setTabHidden(on)
    Animated.timing(sheetH, {
      toValue: on ? 0 : sheetBaseRef.current,
      duration: 220,
      useNativeDriver: false,
    }).start()
  }
  // 탭바가 접히는 것과 같은 속도(200ms)로 시트 보정 높이를 키운다
  useEffect(() => {
    Animated.timing(tabPad, {
      toValue: tabHidden && !immersive ? tabBarH : 0,
      duration: 200,
      useNativeDriver: false,
    }).start()
  }, [tabHidden, immersive, tabBarH, tabPad])
  const sheetHeight = useMemo(() => Animated.add(sheetH, tabPad), [sheetH, tabPad])

  // 지도 탭을 벗어나면 몰입 해제(탭바가 숨은 채 다른 화면으로 가지 않도록)
  const focused = useIsFocused()
  useEffect(() => {
    if (!focused && immersiveRef.current) setImmersiveMode(false)
    // 다른 화면에서 숨겨둔 탭바가 남아 있으면 시트 위치가 어긋나므로 진입 시 복구
    if (focused && !immersiveRef.current) setTabHidden(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused])

  const { coords, loading: locLoading, refresh: refreshLocation } = useCurrentLocation()
  // 내 위치 버튼 재측정 중 표시(스피너)
  const [locating, setLocating] = useState(false)
  // 카테고리 선택 시 해당 contentTypeId로 재조회(필터가 마커·리스트에 실제 반영)
  const { data: poisData, isFetching: poisFetching } = useMapPoisMulti(
    lang,
    40,
    catFilter.map((c) => contentTypeFor(c, lang)).filter((x): x is string => !!x),
  )
  const places = useMemo(() => poisData?.pois ?? [], [poisData])
  const poisMock = poisData?.provider === 'mock'
  // 현재 위치로부터 거리순 정렬 + 거리(m) 부착. 좌표 없는 항목은 뒤로.
  const sortedPlaces = useMemo(() => {
    const here = { latitude: coords.latitude, longitude: coords.longitude }
    return places
      .map((p) => ({
        ...p,
        dist:
          p.lat != null && p.lng != null ? distanceM(here, { lat: p.lat, lng: p.lng }) : Infinity,
      }))
      .sort((a, b) => a.dist - b.dist)
  }, [places, coords.latitude, coords.longitude])

  const googleRef = useRef<GoogleMapHandle>(null)
  const naverRef = useRef<NaverMapHandle>(null)

  // 선택 기본값 = 가장 가까운 장소 (effect 없이 파생)
  const selectedId = selected ?? sortedPlaces[0]?.id ?? null

  const place = useMemo(() => {
    // 베이스맵 POI 탭 장소가 현재 선택이면 그 정보를 시트에 표시
    if (tapped && tapped.id === selectedId) return { ...tapped, dist: Infinity }
    return sortedPlaces.find((p) => p.id === selectedId) ?? sortedPlaces[0]
  }, [sortedPlaces, selectedId, tapped])

  // 선택 장소의 리뷰(제목·AI 요약·출처 카드·목록)는 공용 PlaceReviewsSection이 담당
  // — 장소 상세(place.tsx)와 레이아웃·기능 단일화. key=place.id 로 장소 변경 시 필터 초기화.

  // 검색 결과로 지도 이동
  const goToSearchResult = (r: NaverPoi) => {
    naverRef.current?.moveTo(r.lat, r.lng, WALK_ZOOM)
    googleRef.current?.moveTo(r.lat, r.lng, WALK_ZOOM)
    setSubmittedQuery('') // 결과 목록 닫기
    setSearchQuery(r.name)
  }
  const onSearchSubmit = () => {
    const q = searchQuery.trim()
    if (q) setSubmittedQuery(q)
  }

  // 카테고리 필터 토글 — 다중 선택. 켜진 칩을 다시 누르면 해제, 모두 해제 = 전체.
  const toggleCat = (key: string) => {
    setCatFilter((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
    setSelected(null)
  }

  // 내 방향(나침반) 구독 — 위치 핀의 방향 빔을 두 지도에 동기 회전(8도 이상 변화 시만).
  // 방위 표시 FAB는 제거했고, 방향은 지도 위 내 위치 핀으로만 표시한다.
  useEffect(() => {
    let sub: Location.LocationSubscription | undefined
    let last = -999
    Location.watchHeadingAsync((h) => {
      const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading
      if (last >= 0 && Math.abs(((deg - last + 540) % 360) - 180) < 8) return
      last = deg
      naverRef.current?.setHeading(deg)
      googleRef.current?.setHeading(deg)
    })
      .then((s) => {
        sub = s
      })
      .catch(() => {})
    return () => sub?.remove()
  }, [])

  // 내 위치로 이동 + 파란 점 표시 — 탭할 때마다 GPS를 새로 측정한다.
  // (마운트 시 1회 좌표만 재사용하면 캐시·폴백 지점에 고정돼 잘못된 위치를 계속 가리킴)
  const goToMyLocation = async () => {
    if (locating) return
    setLocating(true)
    const fresh = await refreshLocation()
    const c = fresh ?? coords // 측정 실패 시 마지막 좌표로 이동
    naverRef.current?.setMyLocation(c.latitude, c.longitude, WALK_ZOOM)
    googleRef.current?.setMyLocation(c.latitude, c.longitude, WALK_ZOOM)
    setLocating(false)
  }
  // 지도 유형 순환 (일반→위성→하이브리드)
  const cycleMapType = () => {
    const next = MAP_TYPES[(MAP_TYPES.indexOf(mapType) + 1) % MAP_TYPES.length]
    setMapTypeState(next)
    naverRef.current?.setMapType(next)
    googleRef.current?.setMapType(next)
  }

  // 시트 드래그 — Blend 바와 장소 헤더 두 영역(둘 다 드래그만, 버튼/슬라이더 탭은 통과).
  // ref는 제스처 콜백에서만 읽으므로(렌더 아님) refs 룰 비활성화.
  /* eslint-disable react-hooks/refs */
  // 지정 스냅으로 시트 이동 (제스처·스크롤 공용)
  const snapSheetTo = (h: number) => {
    if (sheetBaseRef.current === h) return
    sheetBaseRef.current = h
    markFull(h === sheetFullH)
    Animated.spring(sheetH, {
      toValue: h,
      useNativeDriver: false,
      bounciness: 2,
      speed: 16,
    }).start()
  }
  const makeSheetPan = (captureVertical = false) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6,
      // Blend 바처럼 자식(Slider)이 가로 제스처를 먹는 영역 — 명확한 세로 드래그만 가로챈다
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        captureVertical && Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_e, g) => {
        const h = Math.max(SHEET_MINI, Math.min(sheetFullH, sheetBaseRef.current - g.dy))
        sheetH.setValue(h)
      },
      onPanResponderRelease: (_e, g) => {
        // 플릭(빠른 스와이프) — 위로 튕기면 최대(FULL), 아래로 튕기면 최소(MINI)
        const target = sheetBaseRef.current - g.dy
        let snap: number
        if (g.vy < -0.5) snap = sheetFullH
        else if (g.vy > 0.5) snap = SHEET_MINI
        else
          // 느린 드래그 — 끝 위치에서 최근접 스냅
          snap = sheetSnaps.reduce(
            (best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best),
            sheetSnaps[0],
          )
        sheetBaseRef.current = snap
        markFull(snap === sheetFullH) // 리뷰 스크롤 활성 여부
        Animated.spring(sheetH, {
          toValue: snap,
          useNativeDriver: false,
          bounciness: 2,
          speed: 16,
        }).start()
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sheetHeadPan = useMemo(() => makeSheetPan(), [sheetH, sheetFullH, sheetSnaps])
  // Blend 바 영역 — 가로 드래그는 Slider(투명도), 세로 드래그는 시트 높이 조절
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const blendBarPan = useMemo(() => makeSheetPan(true), [sheetH, sheetFullH, sheetSnaps])
  // 리뷰 영역 제스처 — 접힌 상태에서는 방향과 무관하게 최대 확장(리뷰를 읽으려는 동작),
  // 최대 상태에서는 목록 최상단에서 아래로 쓸 때만 초기 크기(HALF)로 축소한다.
  // (목록 중간에서의 세로 제스처는 그대로 스크롤)
  // 주변 추천(고정) 영역 — 세로 스와이프 방향으로 즉시 스냅 전환(위=최대, 아래=초기 크기).
  // 시트를 손가락에 붙여 끌지 않으므로 지도·시트가 매 프레임 리레이아웃되지 않는다(떨림 방지).

  const nearbyDoneRef = useRef(false)
  const nearbyPan = useMemo(() => {
    const vertical = (dx: number, dy: number) =>
      Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) * 1.5
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => vertical(g.dx, g.dy),
      onMoveShouldSetPanResponderCapture: (_e, g) => vertical(g.dx, g.dy),
      onPanResponderGrant: () => {
        nearbyDoneRef.current = false
      },
      onPanResponderMove: (_e, g) => {
        if (nearbyDoneRef.current || Math.abs(g.dy) < 14) return
        nearbyDoneRef.current = true
        snapSheetTo(g.dy < 0 ? sheetFullH : SHEET_HALF)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetH, sheetFullH])

  // 스크롤과 동시에 동작해야 해서 PanResponder 대신 gesture-handler를 쓴다.
  // (RN 기본 responder는 네이티브 ScrollView가 터치를 가져가면 캡처가 실패해
  //  "최상단에서 아래로 플릭 → 축소"가 먹지 않았다)
  const reviewYRef = useRef(0)
  const reviewScrollRef = useRef(null)
  const TOP_EPS = 8 // 최상단 판정 여유(px)
  // 리뷰 영역 제스처 판정 — gesture-handler pan과 raw 터치(폴백)가 같은 로직·같은 래치를 쓴다.
  // 네이티브 ScrollView가 터치를 선점하면 pan이 취소되므로 onTouchMove 경로가 이를 커버하고,
  // 한 제스처 안에서 두 경로가 중복 실행돼 "축소 직후 재확장"되는 일이 없도록 래치를 공유한다.
  const touchStartYRef = useRef(0)
  const gestureHandledRef = useRef(false)
  const startedFullRef = useRef(false)
  const startedAtTopRef = useRef(true)
  const beginReviewGesture = (pageY: number) => {
    touchStartYRef.current = pageY
    gestureHandledRef.current = false
    startedFullRef.current = sheetFullRef.current // 시작 시점 상태로만 방향을 해석
    // 축소는 "AI 요약이 보이는 최상단에서 시작한 아래 플릭"에만 반응한다.
    // 스크롤 도중 관성으로 최상단에 닿았다는 이유로 접히면 안 되므로 시작 시점으로 고정.
    startedAtTopRef.current = reviewYRef.current <= TOP_EPS
  }
  const moveReviewGesture = (dy: number, dx = 0) => {
    if (gestureHandledRef.current) return
    if (Math.abs(dy) <= Math.abs(dx) * 1.5) return // 가로 우세 제스처는 무시
    if (!startedFullRef.current) {
      if (Math.abs(dy) > 14) {
        gestureHandledRef.current = true
        snapSheetTo(sheetFullH) // 접힘 상태의 세로 스와이프 → 최대 확장
      }
      return
    }
    if (dy > 40 && startedAtTopRef.current) {
      gestureHandledRef.current = true
      snapSheetTo(SHEET_HALF) // 최상단(AI 요약)에서 아래로 → 초기 크기로 축소
    }
  }
  const reviewGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .simultaneousWithExternalGesture(reviewScrollRef)
        // 터치 이벤트가 ScrollView에 먹혀 onTouchStart가 오지 않는 경우가 있어
        // pan 시작에서도 동일하게 초기화한다(이전 제스처 상태가 남아 오작동하던 문제)
        .onBegin((e) => beginReviewGesture(e.absoluteY))
        .onUpdate((e) => moveReviewGesture(e.translationY, e.translationX)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheetH, sheetFullH],
  )
  /* eslint-enable react-hooks/refs */

  // 선택 장소의 오늘의 딜 — LBS 근접 매칭(REQ-CP-5, UX_REVIEW §4-1).
  // 쿠폰 우선(탭→QR 발급 직행), 없으면 티켓(탭→예매 아웃링크).
  const requireAccount = useRequireAccount()
  const { data: dealCoupons } = useCoupons()
  const [dealTickets, setDealTickets] = useState<Ticket[]>([])
  useEffect(() => {
    let alive = true
    getTickets().then((ts) => alive && setDealTickets(ts))
    return () => {
      alive = false
    }
  }, [])
  const placeDeal = place ? matchDeal(place, dealCoupons ?? []) : null
  const placeTicket =
    place && !placeDeal
      ? matchDeal(
          place,
          dealTickets.map((x) => ({ ...x, name: x.title })),
        )
      : null
  const openPlaceDeal = () => {
    if (!placeDeal) return
    track('coupon_tap', {
      coupon_id: String(placeDeal.id),
      name: placeDeal.name,
      cat: placeDeal.filter,
      is_mock: false,
    })
    requireAccount('auth.gateCoupon', () =>
      router.push({
        pathname: '/coupon-qr',
        params: {
          id: String(placeDeal.id),
          name: placeDeal.name,
          disc: placeDeal.disc,
          detail: placeDeal.detail,
          dist: placeDeal.dist,
        },
      }),
    )
  }
  const openPlaceTicket = () => {
    if (!placeTicket) return
    track('ticket_outlink', { ticket_id: String(placeTicket.id), category: placeTicket.category })
    Linking.openURL(placeTicket.outlinkUrl).catch(() => {})
  }

  // 즐겨찾기 (BACKLOG #20)
  const { data: favorites } = useFavorites()
  const toggleFav = useToggleFavorite()
  const favSet = useMemo(() => new Set((favorites ?? []).map((f) => f.place_ext_id)), [favorites])
  const isFav = !!place && favSet.has(place.id)
  const onToggleFav = () => {
    if (!place) return
    toggleFav.mutate({
      extId: place.id,
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      imageUrl: place.imageUrl,
      cat: place.cat,
    })
  }

  // 지도 마커 데이터 (Naver/Google WebView 공용 — 구조 동일)
  const mapMarkers: NaverMarker[] = useMemo(
    () =>
      sortedPlaces
        .filter((p) => p.lat && p.lng)
        .map((p) => ({
          id: p.id,
          lat: p.lat!,
          lng: p.lng!,
          color: catColor(p.cat),
          glyph: catGlyph(p.cat),
          label: p.name,
        })),
    [sortedPlaces],
  )

  // 스탬프 매장 레이어 (REQ-ST-2) — 테마 카드 구성 매장을 지도에 상시 표시.
  // 찍은 곳은 초록 체크, 남은 곳은 앰버 북마크 → "다음에 어디를 들러야 하는지"가 지도에서 읽힌다.
  // 여러 카드에 같은 매장이 들어갈 수 있어 partnerId로 중복 제거한다.
  const { data: stampCards } = useStampCards()
  const stampStores = useMemo(() => {
    const byId = new Map<string, { name: string; lat: number; lng: number; stamped: boolean }>()
    for (const card of stampCards ?? []) {
      for (const s of card.stores) {
        if (s.lat == null || s.lng == null) continue
        const prev = byId.get(s.partnerId)
        // 한 곳이라도 찍혔으면 찍은 것으로 표시
        byId.set(s.partnerId, {
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          stamped: s.stamped || !!prev?.stamped,
        })
      }
    }
    return [...byId.entries()].map(([partnerId, v]) => ({ partnerId, ...v }))
  }, [stampCards])
  const stampMarkers: NaverMarker[] = useMemo(
    () =>
      stampStores.map((s) => ({
        id: `stamp:${s.partnerId}`,
        lat: s.lat,
        lng: s.lng,
        color: s.stamped ? palette.success[50] : palette.amber[50],
        glyph: s.stamped ? '✅' : '🔖',
        label: s.name,
      })),
    [stampStores],
  )
  // 스탬프 마커 탭 — 해당 매장을 시트 선택 장소로 올려 길찾기까지 이어지게 한다
  const selectStampStore = (markerId: string): boolean => {
    const store = stampStores.find((s) => `stamp:${s.partnerId}` === markerId)
    if (!store) return false
    const poi: Poi = {
      id: markerId,
      name: store.name,
      address: null,
      lat: store.lat,
      lng: store.lng,
      imageUrl: null,
      tel: null,
      cat: 'stamp',
    }
    setTapped(poi)
    setSelected(poi.id)
    return true
  }

  // 마지막 경로 보관 — 지도 전환(unmount→mount) 시에도 양 지도에 경로가 유지되도록
  // 각 지도 onReady에서 재주입한다 (Naver/Google/Blend 어디서든 동일 표시)
  const routePathRef = useRef<LatLng[] | null>(null)

  // 두 지도 뷰(중심·줌) 동기화 — Blend에서 현위치·축척이 정확히 겹치고,
  // 단독 모드에서 이동한 위치가 다른 지도에도 그대로 이어지도록 한다.
  const lastViewRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null)
  const syncUntilRef = useRef(0) // 프로그램적 이동으로 발생한 idle 이벤트 무시 창(루프 방지)
  // ref는 WebView 이벤트 콜백에서만 접근(렌더 아님) — refs 룰 비활성화
  /* eslint-disable react-hooks/refs */
  const onViewChange =
    (src: 'naver' | 'google') => (v: { lat: number; lng: number; zoom: number }) => {
      lastViewRef.current = v
      if (Date.now() < syncUntilRef.current) return
      syncUntilRef.current = Date.now() + 900
      if (src === 'naver') googleRef.current?.moveTo(v.lat, v.lng, v.zoom)
      else naverRef.current?.moveTo(v.lat, v.lng, v.zoom)
    }
  /* eslint-enable react-hooks/refs */

  // 초기 세팅: 현위치를 양 지도 중앙에 배치.
  // WebView 지도는 HTML 초기 좌표(첫 렌더 시점 = 폴백일 수 있음)로 뜨고, ready 이전의
  // injectJavaScript는 그대로 유실된다. 그래서 "GPS 확정"과 "지도 ready"가 모두 충족된
  // 시점에 센터링하도록 ready를 state로 두고 effect에서 함께 기다린다.
  const [mapsReady, setMapsReady] = useState(false)
  const centeredOnceRef = useRef(false)
  useEffect(() => {
    if (locLoading || !mapsReady || centeredOnceRef.current) return
    centeredOnceRef.current = true
    naverRef.current?.setMyLocation(coords.latitude, coords.longitude, WALK_ZOOM)
    googleRef.current?.setMyLocation(coords.latitude, coords.longitude, WALK_ZOOM)
  }, [locLoading, mapsReady, coords.latitude, coords.longitude])

  // 지도 탭에 다시 들어올 때마다 현재 위치를 새로 측정해 중심을 잡는다.
  // (탭 화면은 언마운트되지 않아 위 초기 센터링이 최초 1회만 동작하므로 별도 처리)
  const firstFocusRef = useRef(true)
  useEffect(() => {
    if (!focused) return
    if (firstFocusRef.current) {
      firstFocusRef.current = false // 마운트 직후는 초기 센터링이 담당
      return
    }
    void goToMyLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused])

  const selectPlace = (p: Poi) => {
    setSelected(p.id)
    // 다른 장소 선택 시 기존 경로·리뷰 필터 초기화
    if (p.id !== selectedId) {
      setRouteInfo(null)
      routePathRef.current = null
      naverRef.current?.clearRoute()
      googleRef.current?.clearRoute()
    }
    if (p.lat && p.lng) {
      googleRef.current?.moveTo(p.lat, p.lng, WALK_ZOOM)
      naverRef.current?.moveTo(p.lat, p.lng, WALK_ZOOM)
    }
  }

  // 베이스맵 POI/지도 탭 → 장소 정보 시트 (Google: placeId, Naver: 좌표 최근접)
  // 연속 탭 시 마지막 요청만 반영(seq 가드). 빈 지도 탭(60m 내 시설 없음)은 몰입 모드 진입.
  const lookupSeqRef = useRef(0)
  const onMapPoiTap = async (q: { placeId?: string; lat?: number; lng?: number }) => {
    // 몰입 중에는 어떤 탭이든 즉시 원상 복귀(조회 생략 — 지연 없이)
    if (immersiveRef.current) {
      setImmersiveMode(false)
      return
    }
    const seq = ++lookupSeqRef.current
    const res = await lookupPlace(q, lang)
    if (seq !== lookupSeqRef.current) return
    if (!res) {
      // 조회 실패/시설 없음 — 빈 지면 탭으로 간주해 몰입 모드 진입
      setImmersiveMode(true)
      return
    }
    if (!q.placeId && q.lat != null && q.lng != null && res.lat != null && res.lng != null) {
      // Naver 좌표 탭 게이트 — 최근접 시설이 탭 지점에서 60m 초과면 빈 지면 탭 → 몰입 모드
      if (distanceM({ latitude: q.lat, longitude: q.lng }, { lat: res.lat, lng: res.lng }) > 60) {
        setImmersiveMode(true)
        return
      }
    }
    setTapped(res)
    setSelected(res.id)
    setRouteInfo(null)
  }

  // 길찾기 — 현재 위치 → 선택 장소 (Naver Directions, 양 지도에 Polyline)
  // target 지정 시 그 좌표로(장소 상세 Directions 딥링크), 미지정 시 현재 선택 장소로.
  const startNavigation = async (target?: { lat: number; lng: number }) => {
    const dst = target ?? (place?.lat && place?.lng ? { lat: place.lat, lng: place.lng } : null)
    if (!dst) return
    setRouting(true)
    const start: LatLng = { latitude: coords.latitude, longitude: coords.longitude }
    const goal: LatLng = { latitude: dst.lat, longitude: dst.lng }
    const res = await fetchRoute(start, goal)
    setRouteInfo({ distance: res.distance, duration: res.duration, mock: res.provider === 'mock' })
    // 양 지도에 경로 오버레이 (각 핸들이 전체 경로가 보이도록 영역 맞춤)
    routePathRef.current = res.path
    naverRef.current?.drawRoute(res.path)
    googleRef.current?.drawRoute(res.path)
    setRouting(false)
    // 이동 트래킹 시작 (REQ-LOC-1·2) — 4초/5m 간격으로 내 위치 마커 갱신 + 경로 기록
    journey.start()
  }

  const clearRoute = () => {
    setRouteInfo(null)
    routePathRef.current = null
    naverRef.current?.clearRoute()
    googleRef.current?.clearRoute()
    // 이동 트래킹 종료 — 유효 이동(100m+·도보 속도)이면 walk_journeys 업로드(랭킹 반영)
    journey.stop()
  }

  // 장소 상세 Directions 딥링크 — /(tabs)/map?fName=..&fLat=..&fLng=..&nav=1
  // 해당 장소를 시트에 선택시키고(nav=1이면) 현재 위치→장소 경로까지 그린다.
  const focus = useLocalSearchParams<{
    fId?: string
    fName?: string
    fLat?: string
    fLng?: string
    fCat?: string
    nav?: string
    course?: string // 코스 전체 지도 보기 — JSON [{name,lat,lng}...] (순서 = 방문 순서)
    courseTitle?: string
  }>()
  const focusHandledRef = useRef<string | null>(null)
  useEffect(() => {
    const fLat = Number(focus.fLat)
    const fLng = Number(focus.fLng)
    if (!focus.fName || !Number.isFinite(fLat) || !Number.isFinite(fLng)) return
    const key = `${focus.fId}:${focus.fName}:${focus.fLat}:${focus.fLng}:${focus.nav}`
    if (focusHandledRef.current === key) return
    focusHandledRef.current = key
    const poi: Poi = {
      id: focus.fId || `focus:${focus.fName}`,
      name: focus.fName,
      address: null,
      lat: fLat,
      lng: fLng,
      imageUrl: null,
      tel: null,
      cat: focus.fCat || 'sights',
    }
    setTapped(poi)
    setSelected(poi.id)
    // WebView 지도 로딩 시간 확보 후 이동·경로 — 미로딩 시 경로는 onReady 재주입이 커버
    setTimeout(() => {
      naverRef.current?.moveTo(fLat, fLng, WALK_ZOOM)
      googleRef.current?.moveTo(fLat, fLng, WALK_ZOOM)
      if (focus.nav === '1') void startNavigation({ lat: fLat, lng: fLng })
    }, 700)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.fId, focus.fName, focus.fLat, focus.fLng, focus.nav])

  // 코스 전체 지도 보기 (UX_REVIEW §4-3) — itinerary가 넘긴 스팟 배열을
  // 순번 마커 + 방문 순서 폴리라인으로 펼치고 전체가 보이도록 영역을 맞춘다.
  const courseSpots = useMemo(() => {
    if (!focus.course) return null
    try {
      const arr = JSON.parse(String(focus.course)) as { name: string; lat: number; lng: number }[]
      return Array.isArray(arr) && arr.length >= 2 ? arr : null
    } catch {
      return null
    }
  }, [focus.course])
  const courseHandledRef = useRef<string | null>(null)
  useEffect(() => {
    if (!courseSpots || courseHandledRef.current === focus.course) return
    courseHandledRef.current = String(focus.course)
    const path = courseSpots.map((s) => ({ latitude: s.lat, longitude: s.lng }))
    // WebView 지도 로딩·초기 센터링 이후에 그려 fitBounds가 유지되도록 지연
    setTimeout(() => {
      routePathRef.current = path
      naverRef.current?.drawRoute(path)
      googleRef.current?.drawRoute(path)
    }, 900)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseSpots])
  // 코스 순번 마커 — 인디고 원 + 흰 숫자(두 지도 공통)
  const courseMarkers: NaverMarker[] = useMemo(
    () =>
      (courseSpots ?? []).map((s, i) => ({
        id: `course:${i}`,
        lat: s.lat,
        lng: s.lng,
        color: palette.indigo[40],
        glyph: String(i + 1),
        glyphColor: '#fff',
        label: s.name,
      })),
    [courseSpots],
  )

  const showGoogle = true
  const showNaver = true
  const isBlend = true

  // Blend 레이어 투명도 — Android WebView는 RN View opacity를 무시하므로
  // NaverMap 내부 CSS opacity(setOpacity 핸들)로 제어한다
  const naverOpacity = isBlend ? 1 - blendPos : 1
  const naverOpacityRef = useRef(naverOpacity)
  useEffect(() => {
    naverOpacityRef.current = naverOpacity
    naverRef.current?.setOpacity(naverOpacity)
  }, [naverOpacity])

  // Blend 마커: 두 지도 모두 기본 표시(음식점 등 POI 마커를 구글에도 동일하게).
  // 테두리색으로 소스 구분(Naver 초록/Google 파랑), 바의 Naver/Google 버튼으로 켜고 끔.
  const naverMarkers = useMemo(() => {
    const base = !isBlend
      ? mapMarkers
      : naverMarkersOn
        ? mapMarkers.map((m) => ({ ...m, outline: '#03C75A' }))
        : []
    // 코스 순번·스탬프 매장 마커는 소스 구분 없이 항상 표시(흰 테두리 유지)
    return [...base, ...stampMarkers, ...courseMarkers]
  }, [mapMarkers, isBlend, naverMarkersOn, stampMarkers, courseMarkers])
  const googleMarkers = useMemo(() => {
    const base = !isBlend
      ? mapMarkers
      : googleMarkersOn
        ? mapMarkers.map((m) => ({ ...m, outline: '#4285F4' }))
        : []
    return [...base, ...stampMarkers, ...courseMarkers]
  }, [mapMarkers, isBlend, googleMarkersOn, stampMarkers, courseMarkers])

  // 외부 지도 앱 딥링크 (현지인=Naver / 외국인=Google)
  // Naver: 공식 앱 스킴 nmap://place(좌표+이름 → 정확한 장소 핀) → 미설치 시 웹 지도 검색 폴백
  return (
    <View
      style={ss.container}
      // 첫 레이아웃에서 실제 사용 가능한 높이를 재둔다(FULL 스냅 = 이 높이 = 검색바까지 덮음).
      // 탭바가 접힐 때의 변화는 tabPad 보정이 담당하므로 최초 1회만 기록한다.
      onLayout={(e) => setColH((h) => h || Math.round(e.nativeEvent.layout.height))}>
      {/* 지도 영역 — 최초 측정 높이로 고정. 시트 높이가 바뀌어도 리레이아웃되지 않아
          WebView 지도가 떨리지 않는다(시트는 아래에 absolute로 겹친다) */}
      <View style={[ss.mapArea, { height: colH || Math.round(winH - tabBarH) }]}>
        {/* Google (하단 레이어) — WebView + Maps JS API (라벨 언어 = 앱 설정) */}
        {showGoogle && (
          <GoogleMap
            ref={googleRef}
            latitude={coords.latitude}
            longitude={coords.longitude}
            markers={googleMarkers}
            language={lang}
            selectedId={selectedId ?? undefined}
            onMarkerPress={(id) => {
              if (selectStampStore(id)) return // 스탬프 매장 마커(REQ-ST-2)
              const p = places.find((x) => x.id === id)
              if (p) selectPlace(p)
            }}
            onPoiPress={onMapPoiTap}
            // Google 빈 지면 탭(placeId 없음) — 조회 없이 즉시 몰입 모드 토글
            onMapPress={() => setImmersiveMode(!immersiveRef.current)}
            onReady={() => {
              setMapsReady(true) // 초기 센터링 effect의 트리거
              googleRef.current?.setMyLocation(coords.latitude, coords.longitude, WALK_ZOOM)
              // 재마운트 시 마지막 뷰 복원(다른 지도와 위치·축척 일치).
              // 최초 센터링 전에는 복원하지 않는다 — 폴백 좌표로 뜬 초기 뷰가 내 위치를 덮어씀
              const v = lastViewRef.current
              if (v && centeredOnceRef.current) googleRef.current?.moveTo(v.lat, v.lng, v.zoom)
              // 지도 전환으로 재마운트돼도 진행 중 경로 유지
              if (routePathRef.current) googleRef.current?.drawRoute(routePathRef.current)
            }}
            onViewChange={onViewChange('google')}
            onAuthError={(m) => setMapError(m)}
          />
        )}

        {/* Naver (상단 레이어 — Blend 시 WebView 내부 CSS 투명도로 겹쳐 비교) */}
        {showNaver && (
          <View
            style={StyleSheet.absoluteFill}
            pointerEvents={isBlend && blendPos > 0.5 ? 'none' : 'auto'}>
            <NaverMap
              ref={naverRef}
              latitude={coords.latitude}
              longitude={coords.longitude}
              markers={naverMarkers}
              language={lang}
              selectedId={selectedId ?? undefined}
              onMarkerPress={(id) => {
                if (selectStampStore(id)) return // 스탬프 매장 마커(REQ-ST-2)
                const p = places.find((x) => x.id === id)
                if (p) selectPlace(p)
              }}
              onMapPress={onMapPoiTap}
              onReady={() => {
                setMapsReady(true) // 초기 센터링 effect의 트리거
                naverRef.current?.setMyLocation(coords.latitude, coords.longitude, WALK_ZOOM)
                // 재마운트 시 마지막 뷰 복원 — 최초 센터링 전에는 복원 금지(위 Google 주석 참조)
                const v = lastViewRef.current
                if (v && centeredOnceRef.current) naverRef.current?.moveTo(v.lat, v.lng, v.zoom)
                // HTML 재생성(마커/언어 변경) 시 opacity가 초기화되므로 ready마다 재적용
                naverRef.current?.setOpacity(naverOpacityRef.current)
                // 지도 전환으로 재마운트돼도 진행 중 경로 유지
                if (routePathRef.current) naverRef.current?.drawRoute(routePathRef.current)
                // 첫 로딩 완료 후 Blend 1회 자동 시연(마운트당 1회 — 내부 가드)
                setTimeout(startBlendDemo, 900)
              }}
              onViewChange={onViewChange('naver')}
              onAuthError={(m) => setMapError(m)}
            />
          </View>
        )}

        {/* GPS 로딩 표시 */}
        {locLoading && (
          <View style={ss.locLoading}>
            <ActivityIndicator color={palette.blue[50]} size="small" />
          </View>
        )}

        {/* 상단: 검색 + 토글 — 몰입 모드에서는 숨김(지도 전체 화면) */}
        {!immersive && (
          <SafeAreaView edges={['top']} style={ss.topControls} pointerEvents="box-none">
            <View style={ss.searchBar}>
              <Icon name="search" size={18} color={palette.zinc[500]} />
              <TextInput
                placeholder={t('map.search')}
                placeholderTextColor={palette.zinc[500]}
                style={ss.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={onSearchSubmit}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => {
                    setSearchQuery('')
                    setSubmittedQuery('')
                  }}
                  hitSlop={8}>
                  <Icon name="close" size={16} color={palette.zinc[400]} />
                </Pressable>
              )}
              <Pressable onPress={() => setShowFilter((v) => !v)} hitSlop={8}>
                <Icon
                  name="tune"
                  size={18}
                  color={showFilter || catFilter.length ? palette.blue[50] : palette.zinc[500]}
                />
              </Pressable>
            </View>

            {/* 검색 결과 드롭다운 */}
            {submittedQuery.length > 0 && (
              <View style={ss.searchResults}>
                {searching ? (
                  <View style={ss.searchRow}>
                    <ActivityIndicator size="small" color={palette.blue[50]} />
                  </View>
                ) : searchResults && searchResults.length > 0 ? (
                  searchResults.map((r) => (
                    <Pressable key={r.id} style={ss.searchRow} onPress={() => goToSearchResult(r)}>
                      <Icon name="location_on" size={15} color={palette.coral[50]} filled />
                      <View style={{ flex: 1 }}>
                        <Text style={ss.searchName} numberOfLines={1}>
                          {r.name}
                        </Text>
                        <Text style={ss.searchAddr} numberOfLines={1}>
                          {r.address}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <View style={ss.searchRow}>
                    <Text style={ss.searchAddr}>{t('map.noResults')}</Text>
                  </View>
                )}
              </View>
            )}

            {/* 카테고리 필터 칩 */}
            {showFilter && (
              <View style={ss.filterRow}>
                {CATS.map((c) => {
                  const on = catFilter.includes(c.key)
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => toggleCat(c.key)}
                      style={[
                        ss.filterChip,
                        on && { backgroundColor: c.color, borderColor: c.color },
                      ]}>
                      <Icon name={c.icon} size={12} color={on ? '#fff' : c.color} filled={on} />
                      <Text style={[ss.filterChipText, on && { color: '#fff' }]}>
                        {t(c.labelKey)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            )}

            {/* 지도 인증 오류 안내 (Naver/Google 공용) */}
            {mapError && (
              <View style={ss.naverErr}>
                <Icon name="info" size={13} color={palette.error[50]} />
                <Text style={ss.naverErrText}>{mapError}</Text>
              </View>
            )}

            {/* POI 마커가 샘플 데이터일 때 */}
            {poisMock && <FallbackBadge label="Sample places" />}
          </SafeAreaView>
        )}
      </View>

      {/* 우측 FAB — 내 위치(GPS) / 지도 유형. 지도가 화면 전체를 차지하므로 시트에 가리지 않도록
          시트 높이만큼 띄운다. 몰입 모드에서는 숨김 */}
      {!immersive && (
        <Animated.View
          style={[ss.fabCol, { bottom: Animated.add(sheetHeight, 18) }]}
          pointerEvents="box-none">
          <Pressable style={ss.fab} onPress={goToMyLocation} hitSlop={6}>
            {locating ? (
              <ActivityIndicator size="small" color={palette.blue[50]} />
            ) : (
              <Icon name="my_location" size={20} color={palette.blue[50]} />
            )}
          </Pressable>
          <Pressable style={ss.fab} onPress={cycleMapType} hitSlop={6}>
            <Icon
              name={MAP_TYPE_ICON[mapType]}
              size={20}
              color={mapType === 'normal' ? palette.zinc[700] : palette.blue[50]}
              filled={mapType !== 'normal'}
            />
            <Text style={ss.fabLabel}>{t(`map.type.${mapType}`)}</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* 하단 시트 — 선택 장소 (드래그로 접기/펼치기) */}
      <Animated.View style={[ss.sheet, { height: sheetHeight }]}>
        {/* Blend 투명도 바 — 시트 상단에 상주. 가로 드래그 = Naver(좌)↔Google(우) 투명도,
            세로 드래그 = 시트(리뷰 박스) 높이 조절. 양끝 칩 = 각 지도 마커 표시 토글 */}
        {isBlend && (
          <View style={ss.blendBar} {...blendBarPan.panHandlers}>
            <View>
              <Pressable
                onPress={() => setNaverMarkersOn((v) => !v)}
                hitSlop={8}
                style={[
                  ss.blendChip,
                  { backgroundColor: '#03C75A' },
                  !naverMarkersOn && ss.blendChipOff,
                ]}>
                <Text style={ss.blendChipText}>Naver</Text>
              </Pressable>
              {naverFull && (
                <Animated.View
                  pointerEvents="none"
                  style={[ss.neonRing, { borderColor: '#4ADE80', opacity: neonPulse }]}
                />
              )}
            </View>
            <Slider
              style={{ flex: 1, height: 32 }}
              minimumValue={0}
              maximumValue={1}
              value={blendPos}
              onSlidingStart={cancelBlendDemo}
              onValueChange={setBlendPos}
              minimumTrackTintColor="#03C75A"
              maximumTrackTintColor="#4285F4"
              thumbTintColor={palette.zinc[900]}
            />
            <View>
              <Pressable
                onPress={() => setGoogleMarkersOn((v) => !v)}
                hitSlop={8}
                style={[
                  ss.blendChip,
                  { backgroundColor: '#4285F4' },
                  !googleMarkersOn && ss.blendChipOff,
                ]}>
                <Text style={ss.blendChipText}>Google</Text>
              </Pressable>
              {googleFull && (
                <Animated.View
                  pointerEvents="none"
                  style={[ss.neonRing, { borderColor: '#93C5FD', opacity: neonPulse }]}
                />
              )}
            </View>
          </View>
        )}
        {place ? (
          <>
            {/* 컴팩트 선택 장소 헤드 — 시트 드래그 확장 영역(버튼 탭은 통과, 상하 드래그만 캡처) */}
            <View style={ss.placeHead} {...sheetHeadPan.panHandlers}>
              <View style={ss.placeThumb}>
                {place.imageUrl ? (
                  <CachedImage source={{ uri: place.imageUrl }} style={{ width: 46, height: 46 }} />
                ) : (
                  <PlaceThumb category={place.cat} height={46} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ss.placeName} numberOfLines={1}>
                  {place.name}
                </Text>
                <Text style={ss.placeSub} numberOfLines={1}>
                  {place.address ?? 'Busan'}
                </Text>
              </View>
              <Pressable style={ss.favBtn} onPress={onToggleFav} hitSlop={6}>
                <Icon
                  name="bookmark"
                  size={18}
                  color={isFav ? palette.coral[50] : palette.zinc[400]}
                  filled={isFav}
                />
              </Pressable>
              <Pressable style={ss.dirBtn} onPress={() => startNavigation()} disabled={routing}>
                {routing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Icon name="navigation" size={18} color="#fff" filled />
                )}
              </Pressable>
            </View>
            {/* 이 장소의 오늘의 딜 — 쿠폰(QR 직행) 또는 티켓(예매 아웃링크). LBS 매칭 */}
            {placeDeal && (
              <Pressable onPress={openPlaceDeal} style={ss.dealBar}>
                <Text style={ss.dealBarDisc}>🎟 {placeDeal.disc}</Text>
                <Text style={ss.dealBarText} numberOfLines={1}>
                  {placeDeal.name}
                </Text>
                <Text style={ss.dealBarCta}>{t('map.dealGet')}</Text>
                <Icon name="chevron_right" size={15} color={palette.coral[50]} />
              </Pressable>
            )}
            {placeTicket && (
              <Pressable onPress={openPlaceTicket} style={ss.dealBar}>
                <Text style={ss.dealBarDisc}>🎫 ₩{placeTicket.price.toLocaleString()}</Text>
                <Text style={ss.dealBarText} numberOfLines={1}>
                  {placeTicket.title}
                </Text>
                <Text style={ss.dealBarCta}>{t('map.dealBook')}</Text>
                <Icon name="open_in_new" size={14} color={palette.coral[50]} />
              </Pressable>
            )}
            {/* 경로 요약 + 주변 추천 — 리뷰 스크롤과 분리된 고정 영역.
                세로 플릭/스와이프는 시트 확장(가로 스와이프는 카드 목록에 그대로 전달) */}
            <View {...nearbyPan.panHandlers}>
              {routeInfo && (
                <View style={ss.routeBar}>
                  <Icon name="directions_walk" size={15} color={palette.blue[40]} filled />
                  <Text style={ss.routeText}>
                    {routeInfo.distance > 0
                      ? `${(routeInfo.distance / 1000).toFixed(1)}km · ${t('map.approx')} ${Math.max(1, Math.round(routeInfo.duration / 60000))}${t('map.min')}`
                      : t('map.routeShow')}
                  </Text>
                  {routeInfo.mock && <FallbackBadge label="Sample route" />}
                  <Pressable onPress={clearRoute} hitSlop={8}>
                    <Icon name="close" size={16} color={palette.zinc[500]} />
                  </Pressable>
                </View>
              )}

              {/* 주변 추천 — 현재 위치로부터 거리순 (가로 카드, 좌우 스와이프) */}
              <View style={ss.sectionTitleRow}>
                <Text style={ss.sectionTitle}>
                  {catFilter.length
                    ? catFilter.map((c) => catLabel(t, c)).join(' · ')
                    : t('map.nearbyByDistance')}
                </Text>
                {poisFetching && <ActivityIndicator size="small" color={palette.blue[50]} />}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
                {sortedPlaces.map((p) => {
                  const on = p.id === selectedId
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => selectPlace(p)}
                      style={[
                        ss.attrCardH,
                        on && { borderColor: catColor(p.cat), borderWidth: 1.5 },
                      ]}>
                      <View style={ss.attrThumbH}>
                        {p.imageUrl ? (
                          <CachedImage
                            source={{ uri: p.imageUrl }}
                            style={{ width: 150, height: 92 }}
                          />
                        ) : (
                          <PlaceThumb category={p.cat} height={92} />
                        )}
                      </View>
                      <View style={{ padding: 8, paddingTop: 6 }}>
                        <Text style={ss.attrName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <View style={ss.attrMetaRow}>
                          <View style={[ss.catDot, { backgroundColor: catColor(p.cat) }]} />
                          <Text style={ss.attrMeta} numberOfLines={1}>
                            {catLabel(t, p.cat)}
                          </Text>
                          {p.dist !== Infinity && (
                            <Text style={ss.attrDist}> · {fmtDistance(p.dist)}</Text>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  )
                })}
              </ScrollView>
            </View>

            {/* 리뷰 — 시트가 최대일 때만 스크롤. 접힘 상태의 세로 스와이프는 최대 확장,
                최대 상태에서 최상단을 아래로 쓸면 초기 크기로 축소(reviewGesture) */}
            <GestureDetector gesture={reviewGesture}>
              <View
                style={{ flex: 1 }}
                onTouchStart={(e) => beginReviewGesture(e.nativeEvent.pageY)}
                onTouchMove={(e) =>
                  moveReviewGesture(e.nativeEvent.pageY - touchStartYRef.current)
                }>
                <GHScrollView
                  ref={reviewScrollRef}
                  style={{ flex: 1 }}
                  scrollEnabled={sheetFull}
                  showsVerticalScrollIndicator
                  contentContainerStyle={{ paddingBottom: 28 }}
                  keyboardShouldPersistTaps="handled"
                  // 스크롤 중에는 시트 크기를 건드리지 않는다(축소는 제스처 시작 위치로만 판정)
                  scrollEventThrottle={16}
                  onScroll={(e) => {
                    reviewYRef.current = e.nativeEvent.contentOffset.y // 제스처 시작 시 최상단 판정용
                    tabBarAutoHide.onScroll(e)
                  }}>
                  {/* 공용 섹션(장소 상세와 동일 레이아웃). key로 장소 변경 시 필터 초기화 */}
                  <PlaceReviewsSection
                    key={place.id}
                    target={{ id: place.id, name: place.name, lat: place.lat, lng: place.lng }}
                  />
                </GHScrollView>
              </View>
            </GestureDetector>
          </>
        ) : (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator color={palette.blue[50]} />
            <Text style={ss.loadingText}>Loading nearby places…</Text>
          </View>
        )}
      </Animated.View>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E5ECF2' },
  mapArea: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  topControls: { position: 'absolute', top: 0, left: 12, right: 12, gap: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,.96)',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
    ...shadows.card,
  },
  searchInput: { flex: 1, fontSize: 13, color: palette.zinc[900], padding: 0 },
  toggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.96)',
    ...shadows.card,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  toggleLabel: { fontSize: 11, fontWeight: '700' },
  toggleSub: { fontSize: 9, fontWeight: '600', borderRadius: 999, lineHeight: 14 },
  naverErr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '90%',
  },
  naverErrText: { fontSize: 10.5, color: palette.error[50], fontWeight: '600', flexShrink: 1 },

  locLoading: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(255,255,255,.95)',
    borderRadius: 999,
    padding: 8,
    ...shadows.card,
  },

  // 우측 FAB 컬럼 — 내 위치 / 지도 유형
  fabCol: { position: 'absolute', right: 14, gap: 10, alignItems: 'center' }, // bottom은 시트 높이에 맞춰 동적
  fab: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,.97)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  fabLabel: { fontSize: 7.5, fontWeight: '700', color: palette.zinc[600], marginTop: 1 },

  // 검색 결과 드롭다운
  searchResults: {
    backgroundColor: 'rgba(255,255,255,.98)',
    borderRadius: 16,
    paddingVertical: 4,
    ...shadows.card,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  searchName: { fontSize: 13, fontWeight: '700', color: palette.zinc[900] },
  searchAddr: { fontSize: 11, color: palette.zinc[500], marginTop: 1 },

  // 카테고리 필터 칩
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'flex-start' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: palette.zinc[300],
    backgroundColor: 'rgba(255,255,255,.96)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    ...shadows.card,
  },
  filterChipText: { fontSize: 11, fontWeight: '700', color: palette.zinc[700] },

  // 완전 Naver/Google 상태 알림용 네온 테두리(깜빡임)
  neonRing: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    left: -4,
    right: -4,
    borderRadius: 999,
    borderWidth: 2.5,
  },
  // 시트 상단 상주 바 — 투명도 조절 + 시트 높이 드래그 겸용
  blendBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.zinc[100],
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginTop: 6, // grabber 제거 — 바 자체가 드래그 핸들
    marginBottom: 6,
  },
  blendChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  blendChipOff: { opacity: 0.35 },
  blendChipText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 8,
    overflow: 'hidden', // 접힘 시 하단 콘텐츠 클리핑
    ...shadows.pop,
  },
  placeHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  placeThumb: { width: 46, height: 46, borderRadius: 12, overflow: 'hidden' },
  placeName: { fontSize: 15, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.2 },
  placeSub: { fontSize: 11, color: palette.zinc[500], marginTop: 1, lineHeight: 15 },

  // 섹션 제목 (주변 추천 / 리뷰)
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.zinc[700],
    marginTop: 12,
    marginBottom: 6,
  },
  // 추천 관광지 세로 카드
  // 가로 추천 카드 (좌우 스와이프)
  attrCardH: {
    width: 150,
    borderWidth: 1,
    borderColor: palette.zinc[200],
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  attrThumbH: { width: 150, height: 92, overflow: 'hidden' },
  attrName: { fontSize: 13, fontWeight: '700', color: palette.zinc[900], letterSpacing: -0.1 },
  attrMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  catDot: { width: 7, height: 7, borderRadius: 999, marginRight: 5 },
  attrMeta: { fontSize: 11, color: palette.zinc[500], fontWeight: '600' },
  attrDist: { fontSize: 11, color: palette.blue[40], fontWeight: '700' },
  // 개별 리뷰 항목
  reviewItem: {
    flexDirection: 'row',
    gap: 9,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.zinc[200],
  },
  reviewAvatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarFlag: { fontSize: 16 },
  reviewItemTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewWho: { fontSize: 12, fontWeight: '700', color: palette.zinc[900] },
  reviewTime: { fontSize: 10, color: palette.zinc[400], marginLeft: 'auto' },
  reviewItemText: { fontSize: 12, color: palette.zinc[700], marginTop: 2, lineHeight: 17 },
  reviewTapHint: { fontSize: 10.5, color: palette.blue[50], fontWeight: '700', marginTop: 3 },
  loadingText: { fontSize: 12, color: palette.zinc[500], marginTop: 8 },
  dirBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: palette.blue[50],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blue,
  },
  favBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.blue[95],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  routeText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: palette.blue[30] },

  // 선택 장소 딜 바 — 쿠폰/티켓 배지(코럴 톤, S-7 "가치 먼저" 원칙에 맞춘 정보형 표시)
  dealBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  dealBarDisc: { fontSize: 12.5, fontWeight: '800', color: palette.coral[50] },
  dealBarText: { flex: 1, fontSize: 12, fontWeight: '600', color: palette.zinc[700] },
  dealBarCta: { fontSize: 12, fontWeight: '800', color: palette.coral[50] },

  // 리뷰 — 한국인/외국인 좌우 카드
  aiSummaryCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#BFDBFE',
    padding: 12,
    gap: 6,
  },
  aiSummaryHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiSummaryTitle: { fontSize: 12, fontWeight: '800', color: palette.blue[50], flex: 1 },
  aiSummaryText: { fontSize: 12.5, lineHeight: 18, color: palette.zinc[700] },
  aiSummarySrc: { fontSize: 10.5, color: palette.zinc[400] },
  reviewRow: { flexDirection: 'row', gap: 10 },
  reviewCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 10,
    backgroundColor: '#fff',
    gap: 5,
  },
  // 선택된 출처 카드 — 굵은 테두리 + 옅은 배경 틴트
  reviewCardSelN: { borderWidth: 2, backgroundColor: '#EFFBF3' },
  reviewCardSelG: { borderWidth: 2, backgroundColor: '#EFF4FE' },
  // 필터 활성 시 미선택 카드는 흐리게
  reviewCardDim: { opacity: 0.45 },
  reviewCardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewExtBtn: { padding: 2 }, // 우측 상단 외부지도 아이콘(이것만 탭 시 지도 앱 호출)
  reviewCardTitle: { flex: 1, fontSize: 11, fontWeight: '800', color: palette.zinc[800] },
  reviewStars: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  reviewScore: { fontSize: 11, fontWeight: '800', color: palette.zinc[700], marginLeft: 4 },
  reviewQuote: { fontSize: 11.5, color: palette.zinc[600], lineHeight: 16 },
  reviewNone: { fontSize: 11, color: palette.zinc[400], marginTop: 6, fontStyle: 'italic' },
  reviewOverall: { fontSize: 12, fontWeight: '700', color: palette.amber[50] },
  platformBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
})
