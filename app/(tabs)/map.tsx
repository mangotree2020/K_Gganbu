import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg'

import { Icon } from '@/components/brand'
import { PlaceThumb } from '@/components/PlaceThumb'
import { palette, shadows } from '@/theme/tokens'

type Review = { user: string; flag: string; text: string; time: string }
type Place = {
  id: string
  cat: string
  name: string
  ko: string
  subtitle: string
  dist: string
  openNow: boolean
  naver: { rating: number; count: number }
  google: { rating: number; count: number }
  reviews: { naver: Review[]; google: Review[] }
  top: string
  left: string
  pinIcon: string
  pinColor: string
}

const PLACES: Place[] = [
  {
    id: 'mipo',
    cat: 'seafood',
    name: 'Mipojeong',
    ko: '미포정',
    subtitle: 'Seafood · ₩₩',
    dist: '380m',
    openNow: true,
    naver: { rating: 4.6, count: 1247 },
    google: { rating: 4.4, count: 312 },
    reviews: {
      naver: [
        {
          user: '민지',
          flag: '🇰🇷',
          text: '엄마 손맛 그대로. 회식 안주로 최고. 막걸리랑 환상',
          time: '3d',
        },
        {
          user: 'Junho',
          flag: '🇰🇷',
          text: '양 많고 가격 착해요. 평일 점심엔 사람이 좀 많음.',
          time: '1w',
        },
      ],
      google: [
        {
          user: 'Emma R.',
          flag: '🇺🇸',
          text: 'The owner translated using her phone — best raw fish outside Tokyo.',
          time: '1mo',
        },
        {
          user: 'Markus',
          flag: '🇩🇪',
          text: 'No English menu but staff helpful. The set was a great deal.',
          time: '2mo',
        },
      ],
    },
    top: '30%',
    left: '26%',
    pinIcon: 'set_meal',
    pinColor: palette.coral[50],
  },
  {
    id: 'bada',
    cat: 'cafe',
    name: 'Bada View Cafe',
    ko: '바다뷰',
    subtitle: 'Cafe · ₩',
    dist: '520m',
    openNow: true,
    naver: { rating: 4.5, count: 892 },
    google: { rating: 4.7, count: 540 },
    reviews: {
      naver: [
        { user: '지원', flag: '🇰🇷', text: '통창 자리 명당. 직원 친절. 디저트는 평범.', time: '1w' },
      ],
      google: [
        {
          user: 'Sarah',
          flag: '🇬🇧',
          text: 'The view!! Worth the sunrise. Latte was 6.5k won.',
          time: '2w',
        },
      ],
    },
    top: '44%',
    left: '48%',
    pinIcon: 'local_cafe',
    pinColor: palette.amber[50],
  },
  {
    id: 'gamcheon',
    cat: 'village',
    name: 'Gamcheon Village',
    ko: '감천문화마을',
    subtitle: 'Heritage · 4.9★',
    dist: '8.2km',
    openNow: false,
    naver: { rating: 4.3, count: 18234 },
    google: { rating: 4.5, count: 9120 },
    reviews: {
      naver: [
        {
          user: '예진',
          flag: '🇰🇷',
          text: '사진 명소. 평일 오전 추천. 골목 길 좁고 가팔라요.',
          time: '2w',
        },
      ],
      google: [
        {
          user: 'Liam',
          flag: '🇦🇺',
          text: 'Like Santorini with kimchi. Get the stamp tour map.',
          time: '1mo',
        },
      ],
    },
    top: '62%',
    left: '32%',
    pinIcon: 'holiday_village',
    pinColor: palette.cruise.base,
  },
]

const PROVIDERS = [
  { id: 'naver', label: 'Naver', sub: '한국인', color: '#03C75A' },
  { id: 'blend', label: 'Blend', sub: 'Both', color: palette.blue[50] },
  { id: 'google', label: 'Google', sub: 'Foreigners', color: '#4285F4' },
]

function MapMock() {
  return (
    <Svg
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      viewBox="0 0 400 600"
      style={StyleSheet.absoluteFill}>
      <Rect width="400" height="600" fill="#BAE6FD" />
      <Path
        d="M -20 80 Q 80 60, 180 120 Q 280 160, 340 100 L 420 80 L 420 -20 L -20 -20 Z"
        fill="#E0F2FE"
      />
      <Path
        d="M -20 460 Q 100 480, 200 440 Q 320 400, 420 480 L 420 620 L -20 620 Z"
        fill="#E0F2FE"
      />
      <G stroke="rgba(255,255,255,.85)" strokeWidth="6" fill="none" strokeLinecap="round">
        <Path d="M -20 300 Q 100 320, 200 300 Q 300 280, 420 320" />
        <Path d="M 80 -20 Q 120 200, 60 400 Q 50 500, 90 620" />
        <Path d="M 320 -20 Q 280 180, 340 320 Q 360 480, 320 620" />
        <Path d="M 200 -20 L 200 620" strokeOpacity="0.6" />
      </G>
      <G stroke="rgba(255,255,255,.55)" strokeWidth="2.5" fill="none">
        <Path d="M -20 200 Q 200 220, 420 200" />
        <Path d="M -20 380 Q 200 360, 420 380" />
        <Path d="M 140 -20 L 140 620" />
        <Path d="M 260 -20 L 260 620" />
      </G>
      <Ellipse cx="260" cy="220" rx="60" ry="30" fill="#BBF7D0" opacity="0.7" />
      <SvgText x="150" y="60" fill="rgba(15,23,42,.6)" fontSize="11" fontWeight="700">
        해운대 · Haeundae
      </SvgText>
      <SvgText x="30" y="540" fill="rgba(15,23,42,.55)" fontSize="11" fontWeight="700">
        광안리 · Gwangalli
      </SvgText>
    </Svg>
  )
}

function ReviewRow({ r }: { r: Review }) {
  return (
    <View style={ss.reviewRow}>
      <View style={ss.reviewAvatar}>
        <Text style={ss.reviewAvatarText}>{r.user[0]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={ss.reviewHead}>
          <Text style={ss.reviewUser}>
            {r.user} {r.flag}
          </Text>
          <Text style={ss.reviewTime}>{r.time}</Text>
        </View>
        <Text style={ss.reviewText} numberOfLines={2}>
          {r.text}
        </Text>
      </View>
    </View>
  )
}

function ReviewCompare({ place, provider }: { place: Place; provider: string }) {
  if (provider === 'naver' || provider === 'google') {
    const meta = place[provider]
    const rev = place.reviews[provider]
    const color = provider === 'naver' ? '#03C75A' : '#4285F4'
    return (
      <View style={ss.compareBox}>
        <View style={ss.compareHead}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[ss.platformBadge, { backgroundColor: color }]}>
              <Text style={ss.platformBadgeText}>{provider === 'naver' ? 'N' : 'G'}</Text>
            </View>
            <View>
              <Text style={ss.compareTitle}>
                {provider === 'naver' ? 'Naver Reviews' : 'Google Reviews'}
              </Text>
              <Text style={ss.compareMeta}>
                {provider === 'naver' ? '한국인' : 'Foreigners'} · {meta.count.toLocaleString()}{' '}
                reviews
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="star" size={16} color={palette.amber[50]} filled />
            <Text style={ss.compareRating}>{meta.rating}</Text>
          </View>
        </View>
        <View style={{ gap: 8 }}>
          {rev.map((r, i) => (
            <ReviewRow key={i} r={r} />
          ))}
        </View>
      </View>
    )
  }

  // BLEND
  return (
    <View style={ss.blendBox}>
      <View style={ss.blendHeader}>
        <Icon name="compare_arrows" size={14} color={palette.blue[50]} filled />
        <Text style={ss.blendHeaderText}>
          Two perspectives — Naver (locals) vs Google (foreigners)
        </Text>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={[ss.blendCol, { borderRightWidth: 0.5, borderRightColor: palette.zinc[200] }]}>
          <View style={ss.blendColHead}>
            <View style={[ss.platformBadgeSm, { backgroundColor: '#03C75A' }]}>
              <Text style={ss.platformBadgeText}>N</Text>
            </View>
            <Text style={ss.blendColTitle}>한국인 시선</Text>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' }}>
              <Icon name="star" size={10} color={palette.amber[50]} filled />
              <Text style={ss.blendColRating}>{place.naver.rating}</Text>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {place.reviews.naver.slice(0, 2).map((r, i) => (
              <ReviewRow key={i} r={r} />
            ))}
          </View>
        </View>
        <View style={ss.blendCol}>
          <View style={ss.blendColHead}>
            <View style={[ss.platformBadgeSm, { backgroundColor: '#4285F4' }]}>
              <Text style={ss.platformBadgeText}>G</Text>
            </View>
            <Text style={ss.blendColTitle}>Foreigner view</Text>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' }}>
              <Icon name="star" size={10} color={palette.amber[50]} filled />
              <Text style={ss.blendColRating}>{place.google.rating}</Text>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {place.reviews.google.slice(0, 2).map((r, i) => (
              <ReviewRow key={i} r={r} />
            ))}
          </View>
        </View>
      </View>
      <View style={ss.claudeBar}>
        <Icon name="auto_awesome" size={13} color={palette.blue[50]} filled />
        <Text style={ss.claudeText}>
          Locals love the soup; tourists love the staff&apos;s English effort.
        </Text>
      </View>
    </View>
  )
}

export default function MapScreen() {
  const [provider, setProvider] = useState('blend')
  const [selected, setSelected] = useState('mipo')
  const place = PLACES.find((p) => p.id === selected)!

  return (
    <View style={ss.container}>
      {/* 지도 */}
      <View style={ss.mapArea}>
        <MapMock />

        {/* 상단: 검색 + 토글 */}
        <SafeAreaView edges={['top']} style={ss.topControls}>
          <View style={ss.searchBar}>
            <Icon name="search" size={18} color={palette.zinc[500]} />
            <TextInput
              placeholder="Search on map…"
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
                    {o.sub}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </SafeAreaView>

        {/* 핀 */}
        {PLACES.map((p) => {
          const on = p.id === selected
          return (
            <Pressable
              key={p.id}
              onPress={() => setSelected(p.id)}
              style={[ss.pin, { top: p.top, left: p.left, transform: [{ scale: on ? 1.15 : 1 }] }]}>
              <Svg width="36" height="44" viewBox="0 0 36 44">
                <Path
                  d="M18 0 C8 0 0 8 0 18 C0 32 18 44 18 44 C18 44 36 32 36 18 C36 8 28 0 18 0 Z"
                  fill={p.pinColor}
                />
                <Circle cx="18" cy="17" r="11" fill="#fff" />
              </Svg>
              <View style={ss.pinIcon}>
                <Icon name={p.pinIcon} size={14} color={p.pinColor} filled />
              </View>
            </Pressable>
          )
        })}

        {/* 현재 위치 */}
        <View style={ss.youHere} />
      </View>

      {/* 하단 시트 */}
      <View style={ss.sheet}>
        <View style={ss.grabber} />
        <View style={ss.placeHead}>
          <View style={ss.placeThumb}>
            <PlaceThumb category={place.cat} height={56} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ss.placeName}>{place.name}</Text>
            <Text style={ss.placeSub}>
              {place.ko} · {place.subtitle} · {place.dist}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Icon
                name="circle"
                size={6}
                color={place.openNow ? palette.success[50] : palette.error[50]}
                filled
              />
              <Text
                style={[
                  ss.openText,
                  { color: place.openNow ? palette.success[50] : palette.error[50] },
                ]}>
                {place.openNow ? 'Open' : 'Closed'}
              </Text>
              <Text style={ss.openSub}>· until 22:00</Text>
            </View>
          </View>
          <Pressable style={ss.dirBtn}>
            <Icon name="navigation" size={20} color="#fff" filled />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}>
          <ReviewCompare place={place} provider={provider} />
        </ScrollView>
      </View>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#BAE6FD' },
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
  pin: { position: 'absolute', width: 36, height: 44, marginLeft: -18, marginTop: -44 },
  pinIcon: { position: 'absolute', top: 10, left: 11 },
  youHere: {
    position: 'absolute',
    top: '50%',
    left: '62%',
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: palette.blue[50],
    borderWidth: 3,
    borderColor: '#fff',
  },

  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingHorizontal: 16,
    maxHeight: 360,
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
  placeSub: { fontSize: 11, color: palette.zinc[500], marginTop: 2 },
  openText: { fontSize: 11, fontWeight: '700' },
  openSub: { fontSize: 11, color: palette.zinc[500] },
  dirBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: palette.blue[50],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blue,
  },

  compareBox: {
    backgroundColor: palette.zinc[50],
    borderRadius: 16,
    padding: 14,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  compareHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  platformBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformBadgeSm: {
    width: 16,
    height: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  compareTitle: { fontSize: 12, fontWeight: '700', color: palette.zinc[900] },
  compareMeta: { fontSize: 10, color: palette.zinc[500] },
  compareRating: { fontSize: 16, fontWeight: '800', color: palette.zinc[900] },

  blendBox: {
    backgroundColor: palette.zinc[50],
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  blendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: palette.zinc[200],
  },
  blendHeaderText: { flex: 1, fontSize: 11, fontWeight: '700', color: palette.zinc[900] },
  blendCol: { flex: 1, padding: 10, paddingHorizontal: 12 },
  blendColHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  blendColTitle: { fontSize: 10.5, fontWeight: '700', color: palette.zinc[900] },
  blendColRating: { fontSize: 10, color: palette.zinc[500] },
  claudeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.blue[95],
    borderTopWidth: 0.5,
    borderTopColor: palette.zinc[200],
    padding: 8,
    paddingHorizontal: 14,
  },
  claudeText: { flex: 1, fontSize: 11, color: palette.blue[30] },

  reviewRow: { flexDirection: 'row', gap: 8 },
  reviewAvatar: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: palette.zinc[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { fontSize: 10, fontWeight: '700', color: palette.zinc[900] },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewUser: { fontSize: 11, fontWeight: '700', color: palette.zinc[900] },
  reviewTime: { fontSize: 9, color: palette.zinc[500], marginLeft: 'auto' },
  reviewText: { fontSize: 11.5, color: palette.zinc[700], marginTop: 2, lineHeight: 16 },
})
