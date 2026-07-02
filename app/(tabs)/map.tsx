import Slider from '@react-native-community/slider'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { FallbackBadge } from '@/components/FallbackBadge'
import { PlaceThumb } from '@/components/PlaceThumb'
import { useFavorites, useToggleFavorite } from '@/features/favorites/queries'
import { GoogleMap, type GoogleMapHandle } from '@/features/map/GoogleMap'
import {
  fetchRoute,
  useMapPois,
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
import { usePlaceReviews, type PlaceReview } from '@/features/review/queries'
import { useReviewInsights } from '@/features/review/insights'
import { translateText } from '@/features/translate/services'
import { useCurrentLocation } from '@/hooks/useCurrentLocation'
import { appFlag, baseLang, flagFor } from '@/lib/flags'
import { useLocaleStore, useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

type ProviderId = 'naver' | 'blend' | 'google'

// 도보 이동 기준 줌(거리 단위) — 검색/내 위치/장소 선택 시 공통 사용
const WALK_ZOOM = 16

// 하단 시트 스냅 높이 — MINI(헤드만), HALF(헤드+카드 절반=초기), FULL(콘텐츠 다수)
const SHEET_MINI = 134
const SHEET_HALF = 230 // 헤드 + 가로 추천카드 절반 정도 보임
const SHEET_FULL = 580
const SHEET_SNAPS = [SHEET_MINI, SHEET_HALF, SHEET_FULL]

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
// 카테고리 키 → 현지화 라벨(없으면 키 그대로)
const catLabel = (t: (k: string) => string, cat: string): string => {
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

const PROVIDERS: { id: ProviderId; label: string; subKey: string; color: string }[] = [
  { id: 'naver', label: 'Naver', subKey: 'map.subNaver', color: '#03C75A' },
  { id: 'blend', label: 'Blend', subKey: 'map.subBlend', color: palette.blue[50] },
  { id: 'google', label: 'Google', subKey: 'map.subGoogle', color: '#4285F4' },
]

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
}
const catColor = (cat: string) => CAT_COLOR[cat] ?? palette.blue[50]

// 개별 리뷰 행 — 리뷰 언어가 앱 언어와 다르면 출발 국기(예: 🇰🇷)를 표시하고,
// 국기를 탭하면 앱 언어로 번역 + 국기를 앱 언어 국기로 교체. 미번역 외국어 리뷰의 국기는
// 화면에 보일 때 탭 유도를 위해 브르르 떨린다(주기적 wiggle).
function ReviewRow({
  review,
  appLang,
  translatedHint,
}: {
  review: PlaceReview
  appLang: string
  translatedHint?: string | null // 서버 캐시(review-insights) 번역 — 있으면 API 호출 없이 즉시 사용
}) {
  const t = useT()
  const needsTranslate = !!review.text && baseLang(review.lang) !== baseLang(appLang)
  const [fetched, setFetched] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const translated = fetched ?? translatedHint ?? null
  const [busy, setBusy] = useState(false)
  const shake = useState(() => new Animated.Value(0))[0]

  // 미번역 외국어 리뷰 국기 — 주기적으로 떨려 "탭하면 번역" 유도
  useEffect(() => {
    if (!needsTranslate || translated) return
    let alive = true
    const wiggle = () => {
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]).start(() => {
        if (alive) setTimeout(() => alive && wiggle(), 2400)
      })
    }
    wiggle()
    return () => {
      alive = false
    }
  }, [needsTranslate, translated, shake])

  const onTapFlag = async () => {
    // 번역이 이미 있으면(캐시 힌트 포함) 원문↔번역 토글만 — 추가 API 호출 없음
    if (translated) {
      setShowOriginal((o) => !o)
      return
    }
    if (!needsTranslate || busy) return
    setBusy(true)
    try {
      const { translatedText } = await translateText({
        source: baseLang(review.lang),
        target: appLang,
        text: review.text,
      })
      setFetched(translatedText)
      setShowOriginal(false)
    } finally {
      setBusy(false)
    }
  }

  const showTranslated = !!translated && !showOriginal
  const flag = showTranslated ? appFlag(appLang) : review.flag || flagFor(review.lang)
  const text = showTranslated ? translated! : review.text
  const wobble = needsTranslate && !translated
  const rotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-11deg', '11deg'] })

  return (
    <View style={ss.reviewItem}>
      <Pressable
        onPress={onTapFlag}
        disabled={(!wobble && !translated) || busy}
        hitSlop={8}
        style={ss.reviewAvatar}>
        <Animated.Text style={[ss.reviewAvatarFlag, wobble && { transform: [{ rotate }] }]}>
          {flag}
        </Animated.Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={ss.reviewItemTop}>
          <Text style={ss.reviewWho}>{review.who}</Text>
          <View style={ss.reviewStars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Icon
                key={s}
                name="star"
                size={9}
                color={s <= review.score ? palette.amber[50] : palette.zinc[200]}
                filled
              />
            ))}
          </View>
          <Text style={ss.reviewTime}>{review.time}</Text>
        </View>
        <Text style={ss.reviewItemText}>{text}</Text>
        {wobble && (
          <Pressable onPress={onTapFlag} hitSlop={6}>
            <Text style={ss.reviewTapHint}>
              {busy ? '…' : `${flagFor(review.lang)} ${t('map.tapTranslate')}`}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

export default function MapScreen() {
  const t = useT()
  const lang = useLocaleStore((s) => s.lang) // 지도 라벨·POI 언어
  const [provider, setProvider] = useState<ProviderId>('blend')
  const [blendOpacity, setBlendOpacity] = useState(0.5)
  const [selected, setSelected] = useState<string | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [routeInfo, setRouteInfo] = useState<{
    distance: number
    duration: number
    mock: boolean
  } | null>(null)
  const [routing, setRouting] = useState(false)

  // 검색 (Naver 지역검색 → 결과로 지도 이동)
  const [searchQuery, setSearchQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const { data: searchResults, isFetching: searching } = useNaverSearch(
    submittedQuery,
    submittedQuery.length > 0,
  )
  // 카테고리 필터 (null = 전체, 단일 선택 → 해당 카테고리만 재조회)
  const [showFilter, setShowFilter] = useState(false)
  const [catFilter, setCatFilter] = useState<string | null>(null)
  // 지도 유형 (일반/위성/하이브리드)
  const [mapType, setMapTypeState] = useState<MapType>('normal')
  // 하단 시트 높이 — 초기 HALF(카드 절반 보임). sheetBaseRef는 현재 스냅 추적.
  const sheetH = useState(() => new Animated.Value(SHEET_HALF))[0]
  const sheetBaseRef = useRef(SHEET_HALF)

  const { coords, loading: locLoading } = useCurrentLocation()
  // 카테고리 선택 시 해당 contentTypeId로 재조회(필터가 마커·리스트에 실제 반영)
  const { data: poisData, isFetching: poisFetching } = useMapPois(
    lang,
    40,
    contentTypeFor(catFilter, lang),
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

  const place = useMemo(
    () => sortedPlaces.find((p) => p.id === selectedId) ?? sortedPlaces[0],
    [sortedPlaces, selectedId],
  )

  // 선택 장소의 실 리뷰(Google Places, 한국인/외국인 분리). 실패 시 mock 폴백.
  const reviewTarget = place
    ? { id: place.id, name: place.name, lat: place.lat, lng: place.lng }
    : null
  const { data: reviews } = usePlaceReviews(reviewTarget, lang)
  const reviewsMock = reviews?.provider === 'mock'
  // AI 요약 + 번역 캐시(REQ-REV-1·2) — 서버가 장소×언어 단위로 저장·재사용
  const { data: insights } = useReviewInsights(reviewTarget, lang)
  // 캐시된 번역 힌트 — 작성자+원문으로 매칭(상대 시간 표기는 캐시 시점에 따라 달라질 수 있음)
  const translatedFor = (r: PlaceReview) =>
    insights?.reviews.find((x) => x.who === r.who && x.text === r.text)?.translated ?? null
  // 리뷰 출처 필터 — 네이버(한국인)/구글(외국인) 카드를 탭하면 해당 리뷰만 표시(토글)
  const [reviewFilter, setReviewFilter] = useState<'korean' | 'foreign' | null>(null)
  // 선택 장소가 바뀌면 필터 초기화
  const shownReviews = useMemo(() => {
    const all = reviews?.reviews ?? []
    if (!reviewFilter) return all
    return all.filter((r) => {
      const isKo = (r.lang ?? '').toLowerCase().startsWith('ko')
      return reviewFilter === 'korean' ? isKo : !isKo
    })
  }, [reviews, reviewFilter])

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

  // 카테고리 필터 토글
  // 단일 선택 — 같은 칩 다시 누르면 전체로 해제. 선택 변경 시 기존 선택 초기화(다른 카테고리 재조회).
  const toggleCat = (key: string) => {
    setCatFilter((prev) => (prev === key ? null : key))
    setSelected(null)
  }

  // 내 위치로 이동 + 파란 점 표시
  const goToMyLocation = () => {
    naverRef.current?.setMyLocation(coords.latitude, coords.longitude, WALK_ZOOM)
    googleRef.current?.setMyLocation(coords.latitude, coords.longitude, WALK_ZOOM)
  }
  // 지도 유형 순환 (일반→위성→하이브리드)
  const cycleMapType = () => {
    const next = MAP_TYPES[(MAP_TYPES.indexOf(mapType) + 1) % MAP_TYPES.length]
    setMapTypeState(next)
    naverRef.current?.setMapType(next)
    googleRef.current?.setMapType(next)
  }

  // 시트 드래그 — grabber에서 위로 끌면 펼침, 아래로 끌면 접힘(탭하면 토글).
  // ref는 제스처 콜백에서만 읽으므로(렌더 아님) refs 룰 비활성화.
  /* eslint-disable react-hooks/refs */
  const sheetPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true, // 탭도 캡처(탭 토글 지원)
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
        onPanResponderMove: (_e, g) => {
          const h = Math.max(SHEET_MINI, Math.min(SHEET_FULL, sheetBaseRef.current - g.dy))
          sheetH.setValue(h)
        },
        onPanResponderRelease: (_e, g) => {
          let snap: number
          if (Math.abs(g.dy) < 5) {
            // 탭 — 다음 스냅으로 순환(MINI→HALF→FULL→MINI)
            const idx = SHEET_SNAPS.indexOf(sheetBaseRef.current)
            snap = SHEET_SNAPS[(idx + 1) % SHEET_SNAPS.length]
          } else {
            // 드래그 — 끝 위치에서 최근접 스냅
            const target = sheetBaseRef.current - g.dy
            snap = SHEET_SNAPS.reduce(
              (best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best),
              SHEET_SNAPS[0],
            )
          }
          sheetBaseRef.current = snap
          Animated.spring(sheetH, {
            toValue: snap,
            useNativeDriver: false,
            bounciness: 2,
            speed: 16,
          }).start()
        },
      }),
    [sheetH],
  )
  /* eslint-enable react-hooks/refs */

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
          label: p.name,
        })),
    [sortedPlaces],
  )

  const selectPlace = (p: Poi) => {
    setSelected(p.id)
    // 다른 장소 선택 시 기존 경로·리뷰 필터 초기화
    if (p.id !== selectedId) {
      setRouteInfo(null)
      setReviewFilter(null)
      naverRef.current?.clearRoute()
      googleRef.current?.clearRoute()
    }
    if (p.lat && p.lng) {
      googleRef.current?.moveTo(p.lat, p.lng, WALK_ZOOM)
      naverRef.current?.moveTo(p.lat, p.lng, WALK_ZOOM)
    }
  }

  // 길찾기 — 현재 위치 → 선택 장소 (Naver Directions, 양 지도에 Polyline)
  const startNavigation = async () => {
    if (!place?.lat || !place?.lng) return
    setRouting(true)
    const start: LatLng = { latitude: coords.latitude, longitude: coords.longitude }
    const goal: LatLng = { latitude: place.lat, longitude: place.lng }
    const res = await fetchRoute(start, goal)
    setRouteInfo({ distance: res.distance, duration: res.duration, mock: res.provider === 'mock' })
    // 양 지도에 경로 오버레이 (각 핸들이 전체 경로가 보이도록 영역 맞춤)
    naverRef.current?.drawRoute(res.path)
    googleRef.current?.drawRoute(res.path)
    setRouting(false)
  }

  const clearRoute = () => {
    setRouteInfo(null)
    naverRef.current?.clearRoute()
    googleRef.current?.clearRoute()
  }

  const showGoogle = provider === 'google' || provider === 'blend'
  const showNaver = provider === 'naver' || provider === 'blend'

  // 외부 지도 앱 딥링크 (현지인=Naver / 외국인=Google)
  // Naver: 공식 앱 스킴 nmap://place(좌표+이름 → 정확한 장소 핀) → 미설치 시 웹 지도 검색 폴백
  // Google: Place ID(review-insights가 확보)로 장소 상세 연결 → 없으면 좌표 핀 폴백
  const openExternal = (kind: 'naver' | 'google') => {
    if (!place?.lat || !place?.lng) return
    const name = encodeURIComponent(place.name)
    if (kind === 'naver') {
      const app = `nmap://place?lat=${place.lat}&lng=${place.lng}&name=${name}&appname=com.mangonw.gganbu`
      const web = `https://map.naver.com/p/search/${name}`
      Linking.openURL(app).catch(() => Linking.openURL(web).catch(() => {}))
      return
    }
    const placeId = insights?.placeKey
    const url = placeId
      ? `https://www.google.com/maps/search/?api=1&query=${name}&query_place_id=${placeId}`
      : `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
    Linking.openURL(url).catch(() => {})
  }

  return (
    <View style={ss.container}>
      {/* 지도 영역 */}
      <View style={ss.mapArea}>
        {/* Google (하단 레이어) — WebView + Maps JS API (라벨 언어 = 앱 설정) */}
        {showGoogle && (
          <GoogleMap
            ref={googleRef}
            latitude={coords.latitude}
            longitude={coords.longitude}
            markers={mapMarkers}
            language={lang}
            selectedId={selectedId ?? undefined}
            onMarkerPress={(id) => {
              const p = places.find((x) => x.id === id)
              if (p) selectPlace(p)
            }}
            onReady={() =>
              googleRef.current?.setMyLocation(coords.latitude, coords.longitude, WALK_ZOOM)
            }
            onAuthError={(m) => setMapError(m)}
          />
        )}

        {/* Naver (상단 레이어 — Blend 시 투명도 적용) */}
        {showNaver && (
          <View
            style={[StyleSheet.absoluteFill, provider === 'blend' && { opacity: blendOpacity }]}
            pointerEvents={provider === 'blend' && blendOpacity < 0.5 ? 'none' : 'auto'}>
            <NaverMap
              ref={naverRef}
              latitude={coords.latitude}
              longitude={coords.longitude}
              markers={mapMarkers}
              language={lang}
              selectedId={selectedId ?? undefined}
              onMarkerPress={(id) => {
                const p = places.find((x) => x.id === id)
                if (p) selectPlace(p)
              }}
              onReady={() =>
                naverRef.current?.setMyLocation(coords.latitude, coords.longitude, WALK_ZOOM)
              }
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

        {/* 상단: 검색 + 토글 */}
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
                color={showFilter || catFilter ? palette.blue[50] : palette.zinc[500]}
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
                const on = catFilter === c.key
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

          <View style={ss.toggle}>
            {PROVIDERS.map((o) => {
              const on = o.id === provider
              return (
                <Pressable
                  key={o.id}
                  onPress={() => {
                    setProvider(o.id)
                    setMapError(null) // 전환 시 이전 지도 오류 초기화 (각 지도가 재마운트되며 다시 보고)
                  }}
                  style={[ss.toggleBtn, on && { backgroundColor: o.color }]}>
                  <Text style={[ss.toggleLabel, { color: on ? '#fff' : palette.zinc[700] }]}>
                    {o.label}
                  </Text>
                  <Text
                    style={[
                      ss.toggleSub,
                      on
                        ? {
                            color: '#fff',
                            backgroundColor: 'rgba(255,255,255,.18)',
                            paddingHorizontal: 5,
                          }
                        : { color: palette.zinc[500] },
                    ]}>
                    {t(o.subKey)}
                  </Text>
                </Pressable>
              )
            })}
          </View>

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

        {/* Blend 투명도 슬라이더 */}
        {provider === 'blend' && (
          <View style={ss.blendSlider} pointerEvents="box-none">
            <View style={ss.blendSliderInner}>
              <View style={[ss.blendChip, { backgroundColor: '#4285F4' }]}>
                <Text style={ss.blendChipText}>Google</Text>
              </View>
              <Slider
                style={{ flex: 1, height: 36 }}
                minimumValue={0}
                maximumValue={1}
                value={blendOpacity}
                onValueChange={setBlendOpacity}
                minimumTrackTintColor="#03C75A"
                maximumTrackTintColor="#4285F4"
                thumbTintColor={palette.zinc[900]}
              />
              <View style={[ss.blendChip, { backgroundColor: '#03C75A' }]}>
                <Text style={ss.blendChipText}>Naver</Text>
              </View>
            </View>
          </View>
        )}

        {/* 우측 FAB — 내 위치(GPS) / 지도 유형 */}
        <View style={ss.fabCol} pointerEvents="box-none">
          <Pressable style={ss.fab} onPress={goToMyLocation} hitSlop={6}>
            <Icon name="my_location" size={20} color={palette.blue[50]} />
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
        </View>
      </View>

      {/* 하단 시트 — 선택 장소 (드래그로 접기/펼치기) */}
      <Animated.View style={[ss.sheet, { height: sheetH }]}>
        <View style={ss.grabberZone} {...sheetPan.panHandlers}>
          <View style={ss.grabber} />
        </View>
        {place ? (
          <ScrollView
            showsVerticalScrollIndicator
            contentContainerStyle={{ paddingBottom: 28 }}
            keyboardShouldPersistTaps="handled">
            {/* 컴팩트 선택 장소 헤드 */}
            <View style={ss.placeHead}>
              <View style={ss.placeThumb}>
                {place.imageUrl ? (
                  <Image source={{ uri: place.imageUrl }} style={{ width: 46, height: 46 }} />
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
              <Pressable style={ss.dirBtn} onPress={startNavigation} disabled={routing}>
                {routing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Icon name="navigation" size={18} color="#fff" filled />
                )}
              </Pressable>
            </View>

            {/* 경로 요약 (Naver Directions) */}
            {routeInfo && (
              <View style={ss.routeBar}>
                <Icon name="route" size={15} color={palette.blue[40]} />
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
                {catFilter ? catLabel(t, catFilter) : t('map.nearbyByDistance')}
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
                        <Image source={{ uri: p.imageUrl }} style={{ width: 150, height: 92 }} />
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

            {/* 리뷰 — 두 관점 요약(실데이터, 언어별 분리) + 개별 리뷰 목록 */}
            <View style={ss.sectionTitleRow}>
              <Text style={ss.sectionTitle}>{t('map.reviews')}</Text>
              {reviews?.rating != null && (
                <Text style={ss.reviewOverall}>
                  ★ {reviews.rating.toFixed(1)} · {reviews.total}
                </Text>
              )}
              {reviewsMock && <FallbackBadge label="Sample" />}
            </View>
            {/* AI 리뷰 요약(REQ-REV-1) — 장소×언어 서버 캐시로 사용자 간 재사용 */}
            {insights?.summary ? (
              <View style={ss.aiSummaryCard}>
                <View style={ss.aiSummaryHead}>
                  <Icon name="auto_awesome" size={14} color={palette.blue[50]} filled />
                  <Text style={ss.aiSummaryTitle}>{t('map.aiSummary')}</Text>
                  {insights.provider === 'mock' && <FallbackBadge label="Sample" />}
                </View>
                <Text style={ss.aiSummaryText}>{insights.summary}</Text>
                {insights.sources && (
                  <Text style={ss.aiSummarySrc}>
                    Google {insights.sources.google} · Naver blog {insights.sources.naver}
                  </Text>
                )}
              </View>
            ) : null}
            <View style={ss.reviewRow}>
              {/* 카드 = 출처 필터(탭하면 해당 리뷰만). 우측 상단 아이콘만 지도 앱 호출 */}
              <Pressable
                onPress={() => setReviewFilter((f) => (f === 'korean' ? null : 'korean'))}
                style={[
                  ss.reviewCard,
                  { borderColor: '#03C75A' },
                  reviewFilter === 'korean' && ss.reviewCardSelN,
                  reviewFilter === 'foreign' && ss.reviewCardDim,
                ]}>
                <View style={ss.reviewCardHead}>
                  <View style={[ss.platformBadge, { backgroundColor: '#03C75A' }]}>
                    <Text style={ss.platformBadgeText}>N</Text>
                  </View>
                  <Text style={ss.reviewCardTitle}>{t('map.reviewKorean')}</Text>
                  <Pressable
                    onPress={() => openExternal('naver')}
                    hitSlop={10}
                    style={ss.reviewExtBtn}>
                    <Icon name="open_in_new" size={15} color="#03C75A" />
                  </Pressable>
                </View>
                {reviews?.korean ? (
                  <>
                    <View style={ss.reviewStars}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Icon
                          key={i}
                          name="star"
                          size={11}
                          color={
                            i <= Math.round(reviews.korean!.score)
                              ? palette.amber[50]
                              : palette.zinc[200]
                          }
                          filled
                        />
                      ))}
                      <Text style={ss.reviewScore}>{reviews.korean.score.toFixed(1)}</Text>
                    </View>
                    <Text style={ss.reviewQuote} numberOfLines={2}>
                      “{reviews.korean.text}”
                    </Text>
                  </>
                ) : (
                  <Text style={ss.reviewNone}>{t('map.reviewNone')}</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setReviewFilter((f) => (f === 'foreign' ? null : 'foreign'))}
                style={[
                  ss.reviewCard,
                  { borderColor: '#4285F4' },
                  reviewFilter === 'foreign' && ss.reviewCardSelG,
                  reviewFilter === 'korean' && ss.reviewCardDim,
                ]}>
                <View style={ss.reviewCardHead}>
                  <View style={[ss.platformBadge, { backgroundColor: '#4285F4' }]}>
                    <Text style={ss.platformBadgeText}>G</Text>
                  </View>
                  <Text style={ss.reviewCardTitle}>{t('map.reviewForeign')}</Text>
                  <Pressable
                    onPress={() => openExternal('google')}
                    hitSlop={10}
                    style={ss.reviewExtBtn}>
                    <Icon name="open_in_new" size={15} color="#4285F4" />
                  </Pressable>
                </View>
                {reviews?.foreign ? (
                  <>
                    <View style={ss.reviewStars}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Icon
                          key={i}
                          name="star"
                          size={11}
                          color={
                            i <= Math.round(reviews.foreign!.score)
                              ? palette.amber[50]
                              : palette.zinc[200]
                          }
                          filled
                        />
                      ))}
                      <Text style={ss.reviewScore}>{reviews.foreign.score.toFixed(1)}</Text>
                    </View>
                    <Text style={ss.reviewQuote} numberOfLines={2}>
                      “{reviews.foreign.text}”
                    </Text>
                  </>
                ) : (
                  <Text style={ss.reviewNone}>{t('map.reviewNone')}</Text>
                )}
              </Pressable>
            </View>
            {/* 개별 리뷰 — 선택된 출처 카드의 리뷰만(필터). 미선택 시 전체 */}
            {shownReviews.length === 0 && reviewFilter ? (
              <Text style={ss.reviewNone}>{t('map.reviewNone')}</Text>
            ) : null}
            {shownReviews.map((r, i) => (
              <ReviewRow key={i} review={r} appLang={lang} translatedHint={translatedFor(r)} />
            ))}
          </ScrollView>
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
  mapArea: { flex: 1, overflow: 'hidden' },
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
  fabCol: { position: 'absolute', right: 14, bottom: 18, gap: 10, alignItems: 'center' },
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

  blendSlider: { position: 'absolute', left: 16, right: 72, bottom: 14 },
  blendSliderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,.96)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    ...shadows.card,
  },
  blendChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  blendChipText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingHorizontal: 16,
    paddingBottom: 8,
    overflow: 'hidden', // 접힘 시 하단 콘텐츠 클리핑
    ...shadows.pop,
  },
  grabberZone: { paddingTop: 10, paddingBottom: 14, alignItems: 'center' }, // 드래그/탭 히트 영역
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 5,
    backgroundColor: palette.zinc[400],
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
