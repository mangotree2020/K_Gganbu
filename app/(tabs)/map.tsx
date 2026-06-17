import Slider from '@react-native-community/slider'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'

import { Icon } from '@/components/brand'
import { FallbackBadge } from '@/components/FallbackBadge'
import { PlaceThumb } from '@/components/PlaceThumb'
import { useFavorites, useToggleFavorite } from '@/features/favorites/queries'
import { fetchRoute, useMapPois, type LatLng, type Poi } from '@/features/map/queries'
import { NaverMap, type NaverMapHandle, type NaverMarker } from '@/features/map/NaverMap'
import { useCurrentLocation } from '@/hooks/useCurrentLocation'
import { useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

type ProviderId = 'naver' | 'blend' | 'google'

const PROVIDERS: { id: ProviderId; label: string; subKey: string; color: string }[] = [
  { id: 'naver', label: 'Naver', subKey: 'map.subNaver', color: '#03C75A' },
  { id: 'blend', label: 'Blend', subKey: 'map.subBlend', color: palette.blue[50] },
  { id: 'google', label: 'Google', subKey: 'map.subGoogle', color: '#4285F4' },
]

// 카테고리 → 마커 색
const CAT_COLOR: Record<string, string> = {
  seafood: palette.coral[50],
  cafe: palette.amber[50],
  sights: palette.teal[40],
  village: palette.cruise.base,
  beach: palette.blue[50],
}
const catColor = (cat: string) => CAT_COLOR[cat] ?? palette.blue[50]
const CAT_ICON: Record<string, string> = {
  seafood: 'set_meal',
  cafe: 'local_cafe',
  sights: 'photo_camera',
  village: 'holiday_village',
  beach: 'beach_access',
}
const catIcon = (cat: string) => CAT_ICON[cat] ?? 'place'

// 커스텀 마커 핀 (디자인 스마일 핀)
function PinMarker({ color, icon, selected }: { color: string; icon: string; selected: boolean }) {
  return (
    <View style={[ss.pin, { transform: [{ scale: selected ? 1.18 : 1 }] }]}>
      <Svg width="36" height="44" viewBox="0 0 36 44">
        <Path
          d="M18 0 C8 0 0 8 0 18 C0 32 18 44 18 44 C18 44 36 32 36 18 C36 8 28 0 18 0 Z"
          fill={color}
        />
        <Circle cx="18" cy="17" r="11" fill="#fff" />
      </Svg>
      <View style={ss.pinIcon}>
        <Icon name={icon} size={14} color={color} filled />
      </View>
    </View>
  )
}

export default function MapScreen() {
  const t = useT()
  const [provider, setProvider] = useState<ProviderId>('blend')
  const [blendOpacity, setBlendOpacity] = useState(0.5)
  const [selected, setSelected] = useState<string | null>(null)
  const [trackMarkers, setTrackMarkers] = useState(true)
  const [naverError, setNaverError] = useState<string | null>(null)
  const [route, setRoute] = useState<LatLng[] | null>(null)
  const [routeInfo, setRouteInfo] = useState<{
    distance: number
    duration: number
    mock: boolean
  } | null>(null)
  const [routing, setRouting] = useState(false)

  const { coords, loading: locLoading } = useCurrentLocation()
  const { data: poisData } = useMapPois('en', 20)
  const places = useMemo(() => poisData?.pois ?? [], [poisData])
  const poisMock = poisData?.provider === 'mock'

  const googleRef = useRef<MapView>(null)
  const naverRef = useRef<NaverMapHandle>(null)

  // 선택 기본값 = 첫 장소 (effect 없이 파생)
  const selectedId = selected ?? places[0]?.id ?? null

  // Android 커스텀 마커 초기 redraw
  useEffect(() => {
    const t = setTimeout(() => setTrackMarkers(false), 1500)
    return () => clearTimeout(t)
  }, [])

  const place = useMemo(
    () => places.find((p) => p.id === selectedId) ?? places[0],
    [places, selectedId],
  )

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

  // 지도 중심 = GPS (로딩 완료 후)
  const region: Region = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  }

  // Naver 마커 데이터
  const naverMarkers: NaverMarker[] = useMemo(
    () =>
      places
        .filter((p) => p.lat && p.lng)
        .map((p) => ({
          id: p.id,
          lat: p.lat!,
          lng: p.lng!,
          color: catColor(p.cat),
          label: p.name,
        })),
    [places],
  )

  const selectPlace = (p: Poi) => {
    setSelected(p.id)
    // 다른 장소 선택 시 기존 경로 제거
    if (p.id !== selectedId) {
      setRoute(null)
      setRouteInfo(null)
      naverRef.current?.clearRoute()
    }
    if (p.lat && p.lng) {
      googleRef.current?.animateToRegion(
        { latitude: p.lat, longitude: p.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        450,
      )
      naverRef.current?.moveTo(p.lat, p.lng, 15)
    }
  }

  // 길찾기 — 현재 위치 → 선택 장소 (Naver Directions, 양 지도에 Polyline)
  const startNavigation = async () => {
    if (!place?.lat || !place?.lng) return
    setRouting(true)
    const start: LatLng = { latitude: coords.latitude, longitude: coords.longitude }
    const goal: LatLng = { latitude: place.lat, longitude: place.lng }
    const res = await fetchRoute(start, goal)
    setRoute(res.path)
    setRouteInfo({ distance: res.distance, duration: res.duration, mock: res.provider === 'mock' })
    naverRef.current?.drawRoute(res.path)
    // Google 지도: 경로 전체가 보이도록 맞춤
    if (res.path.length > 1) {
      googleRef.current?.fitToCoordinates(res.path, {
        edgePadding: { top: 80, right: 50, bottom: 260, left: 50 },
        animated: true,
      })
    }
    setRouting(false)
  }

  const clearRoute = () => {
    setRoute(null)
    setRouteInfo(null)
    naverRef.current?.clearRoute()
  }

  const showGoogle = provider === 'google' || provider === 'blend'
  const showNaver = provider === 'naver' || provider === 'blend'

  // 외부 지도 앱 딥링크 (현지인=Naver / 외국인=Google)
  const openExternal = (kind: 'naver' | 'google') => {
    if (!place?.lat || !place?.lng) return
    const name = encodeURIComponent(place.name)
    const url =
      kind === 'naver'
        ? `https://map.naver.com/v5/search/${name}`
        : `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
    Linking.openURL(url).catch(() => {})
  }

  return (
    <View style={ss.container}>
      {/* 지도 영역 */}
      <View style={ss.mapArea}>
        {/* Google (하단 레이어) */}
        {showGoogle && (
          <MapView
            ref={googleRef}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            region={region}
            showsUserLocation
            showsMyLocationButton={false}
            toolbarEnabled={false}>
            {places
              .filter((p) => p.lat && p.lng)
              .map((p) => (
                <Marker
                  key={p.id}
                  coordinate={{ latitude: p.lat!, longitude: p.lng! }}
                  anchor={{ x: 0.5, y: 1 }}
                  tracksViewChanges={trackMarkers}
                  onPress={() => selectPlace(p)}>
                  <PinMarker
                    color={catColor(p.cat)}
                    icon={catIcon(p.cat)}
                    selected={p.id === selectedId}
                  />
                </Marker>
              ))}
            {/* Naver Directions 경로 오버레이 (PLANNING §17) */}
            {route && route.length > 1 && (
              <Polyline coordinates={route} strokeColor="#0EA5E9" strokeWidth={6} />
            )}
          </MapView>
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
              markers={naverMarkers}
              selectedId={selectedId ?? undefined}
              onMarkerPress={(id) => {
                const p = places.find((x) => x.id === id)
                if (p) selectPlace(p)
              }}
              onAuthError={(m) => setNaverError(m)}
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
            />
            <Icon name="tune" size={18} color={palette.zinc[500]} />
          </View>
          <View style={ss.toggle}>
            {PROVIDERS.map((o) => {
              const on = o.id === provider
              return (
                <Pressable
                  key={o.id}
                  onPress={() => setProvider(o.id)}
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

          {/* Naver 인증 오류 안내 */}
          {showNaver && naverError && (
            <View style={ss.naverErr}>
              <Icon name="info" size={13} color={palette.error[50]} />
              <Text style={ss.naverErrText}>{naverError}</Text>
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
      </View>

      {/* 하단 시트 — 선택 장소 (실데이터) */}
      <View style={ss.sheet}>
        <View style={ss.grabber} />
        {place ? (
          <>
            <View style={ss.placeHead}>
              <View style={ss.placeThumb}>
                {place.imageUrl ? (
                  <Image source={{ uri: place.imageUrl }} style={{ width: 56, height: 56 }} />
                ) : (
                  <PlaceThumb category={place.cat} height={56} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ss.placeName} numberOfLines={1}>
                  {place.name}
                </Text>
                <Text style={ss.placeSub} numberOfLines={2}>
                  {place.address ?? 'Busan'}
                </Text>
              </View>
              {/* 즐겨찾기 토글 (BACKLOG #20) */}
              <Pressable style={ss.favBtn} onPress={onToggleFav} hitSlop={6}>
                <Icon
                  name="bookmark"
                  size={20}
                  color={isFav ? palette.coral[50] : palette.zinc[400]}
                  filled={isFav}
                />
              </Pressable>
              {/* 길찾기 버튼 (현재 위치 → 이 장소) */}
              <Pressable style={ss.dirBtn} onPress={startNavigation} disabled={routing}>
                {routing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Icon name="navigation" size={20} color="#fff" filled />
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

            {/* 두 관점 — 외부 지도 앱으로 열기 */}
            <View style={ss.compareRow}>
              <Pressable
                style={[ss.compareBtn, { borderColor: '#03C75A' }]}
                onPress={() => openExternal('naver')}>
                <View style={[ss.platformBadge, { backgroundColor: '#03C75A' }]}>
                  <Text style={ss.platformBadgeText}>N</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.compareTitle}>Naver 지도</Text>
                  <Text style={ss.compareMeta}>한국인 시선 · 리뷰</Text>
                </View>
                <Icon name="open_in_new" size={16} color="#03C75A" />
              </Pressable>
              <Pressable
                style={[ss.compareBtn, { borderColor: '#4285F4' }]}
                onPress={() => openExternal('google')}>
                <View style={[ss.platformBadge, { backgroundColor: '#4285F4' }]}>
                  <Text style={ss.platformBadgeText}>G</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.compareTitle}>Google Maps</Text>
                  <Text style={ss.compareMeta}>Foreigner view</Text>
                </View>
                <Icon name="open_in_new" size={16} color="#4285F4" />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator color={palette.blue[50]} />
            <Text style={ss.loadingText}>Loading nearby places…</Text>
          </View>
        )}

        {/* 장소 리스트 (실데이터) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingVertical: 10 }}>
          {places.map((p) => {
            const on = p.id === selectedId
            return (
              <Pressable
                key={p.id}
                onPress={() => selectPlace(p)}
                style={[ss.miniCard, on && { borderColor: catColor(p.cat), borderWidth: 1.5 }]}>
                <View style={{ width: 88, height: 56, borderRadius: 10, overflow: 'hidden' }}>
                  {p.imageUrl ? (
                    <Image source={{ uri: p.imageUrl }} style={{ width: 88, height: 56 }} />
                  ) : (
                    <PlaceThumb category={p.cat} height={56} />
                  )}
                </View>
                <Text style={ss.miniName} numberOfLines={1}>
                  {p.name}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>
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
    right: 16,
    backgroundColor: 'rgba(255,255,255,.95)',
    borderRadius: 999,
    padding: 8,
    ...shadows.card,
  },

  blendSlider: { position: 'absolute', left: 16, right: 16, bottom: 14 },
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

  pin: { width: 36, height: 44, alignItems: 'center' },
  pinIcon: { position: 'absolute', top: 10, left: 11 },

  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingHorizontal: 16,
    paddingBottom: 8,
    maxHeight: 320,
    ...shadows.pop,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 4,
    backgroundColor: palette.zinc[300],
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  placeHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  placeThumb: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden' },
  placeName: { fontSize: 15, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.2 },
  placeSub: { fontSize: 11, color: palette.zinc[500], marginTop: 2, lineHeight: 15 },
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

  compareRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  compareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  platformBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  compareTitle: { fontSize: 12, fontWeight: '700', color: palette.zinc[900] },
  compareMeta: { fontSize: 10, color: palette.zinc[500] },

  miniCard: {
    width: 88,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  miniName: {
    fontSize: 10.5,
    fontWeight: '600',
    color: palette.zinc[800],
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
})
