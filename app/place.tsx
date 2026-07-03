// 장소 상세 (홈 Today's Pick·Nearby 카드 → 진입)
// 상태바 영역은 홈과 동일한 스카이블루 그라데이션으로 남기고 그 아래부터 화면 구성.
// 지도 시트와 동일한 리뷰(평점·AI 요약·리뷰 목록)를 제공하고,
// Directions는 우리 지도 탭으로 이동해 해당 장소 선택 + 경로 표시까지 연결한다.
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo } from 'react'
import { Image, Pressable, Share, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Icon, Pill } from '@/components/brand'
import { FallbackBadge } from '@/components/FallbackBadge'
import { PlaceThumb } from '@/components/PlaceThumb'
import { useFavorites, useToggleFavorite } from '@/features/favorites/queries'
import { useReviewInsights } from '@/features/review/insights'
import { usePlaceReviews } from '@/features/review/queries'
import { useLocaleStore, useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

export default function PlaceScreen() {
  const t = useT()
  const lang = useLocaleStore((s) => s.lang)
  const insets = useSafeAreaInsets()
  const p = useLocalSearchParams<{
    cat?: string
    name?: string
    sub?: string
    badge?: string
    rating?: string
    dist?: string
    desc?: string
    img?: string
    extId?: string
    lat?: string
    lng?: string
  }>()

  const name = p.name ?? 'Mipojeong'
  const sub = p.sub ?? 'Seafood · 380m'
  const cat = p.cat ?? 'seafood'
  const dist = p.dist ?? '380m'
  const img = p.img || null
  const lat = p.lat ? Number(p.lat) : null
  const lng = p.lng ? Number(p.lng) : null
  const extId = p.extId || `poi-${name}`
  const desc =
    p.desc ??
    "Beloved by locals for fresh, no-frills seafood. Try the seaside terrace — it's where Haeundae sunsets feel infinite."

  // 지도 시트와 동일한 리뷰 파이프라인 — 실 Google 리뷰 + AI 요약(서버 캐시)
  const reviewTarget = useMemo(() => ({ id: extId, name, lat, lng }), [extId, name, lat, lng])
  const { data: reviews } = usePlaceReviews(reviewTarget, lang)
  const { data: insights } = useReviewInsights(reviewTarget, lang)
  const rating = reviews?.rating != null ? String(reviews.rating) : (p.rating ?? '4.7')
  // 캐시된 번역 힌트 — 작성자+원문 매칭(지도와 동일 규칙)
  const translatedFor = (who: string, text: string) =>
    insights?.reviews.find((x) => x.who === who && x.text === text)?.translated ?? null

  // 즐겨찾기 상태 (extId 기준)
  const { data: favorites } = useFavorites()
  const toggleFav = useToggleFavorite()
  const isFav = useMemo(
    () => (favorites ?? []).some((f) => f.place_ext_id === extId),
    [favorites, extId],
  )

  // 길찾기 — 외부 지도가 아닌 우리 지도 탭으로 이동해
  // 해당 장소를 시트에 선택시키고 현재 위치→장소 경로까지 그린다(map.tsx focus 파라미터).
  const openDirections = () => {
    router.replace({
      pathname: '/(tabs)/map',
      params: {
        fId: extId,
        fName: name,
        fLat: lat != null ? String(lat) : '',
        fLng: lng != null ? String(lng) : '',
        fCat: cat,
        nav: '1',
      },
    })
  }

  const onShare = () => {
    Share.share({ message: `${name} · ${sub}\nK-Gganbu` }).catch(() => {})
  }

  const onBookmark = () => {
    toggleFav.mutate({
      extId,
      name,
      address: sub,
      lat,
      lng,
      imageUrl: img,
      cat,
    })
  }

  return (
    <View style={ss.container}>
      {/* 상태바 영역 — 홈과 동일한 스카이블루 그라데이션(시간·배터리 가독성), 콘텐츠는 그 아래부터 */}
      <LinearGradient
        colors={['#38BDF8', '#0EA5E9']}
        style={{ height: insets.top, width: '100%' }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View>
          {img ? (
            <Image
              source={{ uri: img }}
              style={{ width: '100%', height: 180 }}
              resizeMode="cover"
            />
          ) : (
            <PlaceThumb category={cat} height={180} />
          )}
          <Pressable onPress={() => router.back()} style={ss.close}>
            <Icon name="close" size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={{ padding: 18, paddingBottom: 28 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}>
            <View style={{ flex: 1 }}>
              <Text style={ss.name}>{name}</Text>
              <Text style={ss.sub}>{sub}</Text>
            </View>
            {p.badge && (
              <Pill tone="coral" size="sm">
                {p.badge}
              </Pill>
            )}
          </View>

          <View style={ss.metaRow}>
            <View style={ss.meta}>
              <Icon name="star" size={14} color={palette.amber[50]} filled />
              <Text style={ss.metaText}>
                {rating}
                {reviews?.total ? ` (${reviews.total})` : ''}
              </Text>
            </View>
            <View style={ss.meta}>
              <Icon name="schedule" size={13} color={palette.success[50]} filled />
              <Text style={ss.metaText}>{t('place.open')}</Text>
            </View>
            <View style={ss.meta}>
              <Icon name="directions_walk" size={13} color={palette.zinc[500]} />
              <Text style={ss.metaText}>{dist}</Text>
            </View>
          </View>

          <Text style={ss.desc}>{desc}</Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Pressable style={ss.dirBtn} onPress={openDirections}>
              <Icon name="navigation" size={16} color="#fff" filled />
              <Text style={ss.dirText}>{t('place.directions')}</Text>
            </Pressable>
            <Pressable
              style={[ss.iconBtn, isFav && ss.iconBtnActive]}
              onPress={onBookmark}
              disabled={toggleFav.isPending}>
              <Icon
                name={isFav ? 'bookmark' : 'bookmark_add'}
                size={18}
                color={isFav ? palette.coral[50] : palette.zinc[700]}
                filled={isFav}
              />
            </Pressable>
            <Pressable style={ss.iconBtn} onPress={onShare}>
              <Icon name="share" size={18} color={palette.zinc[700]} />
            </Pressable>
          </View>

          {/* ── 리뷰 — 지도 시트와 동일 데이터(한국인/외국인 관점 + AI 요약 + 목록) ── */}
          {reviews && (
            <View style={{ marginTop: 22 }}>
              <Text style={ss.sectionTitle}>{t('map.reviews')}</Text>

              {/* 관점 요약 카드 — 네이버(한국인)/구글(외국인) 대표 리뷰 */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                {reviews.korean && (
                  <View style={[ss.persCard, { borderColor: '#03C75A55' }]}>
                    <Text style={ss.persLabel}>🇰🇷 Local</Text>
                    <Text style={ss.persScore}>★ {reviews.korean.score}</Text>
                    <Text style={ss.persText} numberOfLines={3}>
                      {reviews.korean.text}
                    </Text>
                  </View>
                )}
                {reviews.foreign && (
                  <View style={[ss.persCard, { borderColor: '#4285F455' }]}>
                    <Text style={ss.persLabel}>🌐 Traveler</Text>
                    <Text style={ss.persScore}>★ {reviews.foreign.score}</Text>
                    <Text style={ss.persText} numberOfLines={3}>
                      {reviews.foreign.text}
                    </Text>
                  </View>
                )}
              </View>

              {/* AI 요약 (서버 캐시 — 지도와 동일 소스) */}
              {insights?.summary ? (
                <View style={ss.aiCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="auto_awesome" size={14} color={palette.blue[50]} filled />
                    <Text style={ss.aiTitle}>AI Summary</Text>
                    {insights.provider === 'mock' && <FallbackBadge label="Sample" />}
                  </View>
                  <Text style={ss.aiText}>{insights.summary}</Text>
                  {insights.sources && (
                    <Text style={ss.aiSources}>
                      Google {insights.sources.google} · Naver blog {insights.sources.naver}
                    </Text>
                  )}
                </View>
              ) : null}

              {/* 개별 리뷰 목록 — 번역 캐시 있으면 번역문 우선, 원문 병기 */}
              {reviews.reviews.map((r, i) => {
                const tr = translatedFor(r.who, r.text)
                return (
                  <View key={`${r.who}-${i}`} style={ss.reviewCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 13 }}>{r.flag}</Text>
                      <Text style={ss.reviewWho}>{r.who}</Text>
                      <Text style={ss.reviewScore}>★ {r.score}</Text>
                      <Text style={ss.reviewTime}>{r.time}</Text>
                    </View>
                    <Text style={ss.reviewText}>{tr ?? r.text}</Text>
                    {tr && (
                      <Text style={ss.reviewOrig} numberOfLines={2}>
                        {r.text}
                      </Text>
                    )}
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  close: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 19, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.3 },
  sub: { fontSize: 12, color: palette.zinc[500], marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, color: palette.zinc[700] },
  desc: { marginTop: 12, fontSize: 13, color: palette.zinc[700], lineHeight: 20 },
  dirBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: palette.blue[50],
    borderRadius: 999,
    paddingVertical: 11,
  },
  dirText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  iconBtn: {
    width: 48,
    borderWidth: 0.5,
    borderColor: palette.zinc[300],
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
  },
  iconBtnActive: { borderColor: palette.coral[50], backgroundColor: palette.coral[95] },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: palette.zinc[900] },
  persCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#FAFAFA',
  },
  persLabel: { fontSize: 11, fontWeight: '800', color: palette.zinc[700] },
  persScore: { fontSize: 12, fontWeight: '800', color: '#D97706', marginTop: 2 },
  persText: { fontSize: 11.5, color: palette.zinc[700], marginTop: 4, lineHeight: 16 },
  aiCard: {
    marginTop: 10,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#EFF6FF',
    ...shadows.card,
  },
  aiTitle: { fontSize: 12, fontWeight: '800', color: '#0369A1' },
  aiText: { fontSize: 12.5, color: palette.zinc[800], lineHeight: 18, marginTop: 6 },
  aiSources: { fontSize: 10.5, color: palette.zinc[500], marginTop: 6 },
  reviewCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    padding: 12,
    backgroundColor: '#fff',
  },
  reviewWho: { fontSize: 12.5, fontWeight: '700', color: palette.zinc[900] },
  reviewScore: { fontSize: 11.5, fontWeight: '800', color: '#D97706' },
  reviewTime: { fontSize: 10.5, color: palette.zinc[400], marginLeft: 'auto' },
  reviewText: { fontSize: 12.5, color: palette.zinc[800], lineHeight: 18, marginTop: 6 },
  reviewOrig: { fontSize: 11, color: palette.zinc[400], lineHeight: 15, marginTop: 4 },
})
