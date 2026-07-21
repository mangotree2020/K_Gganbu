// 장소 상세 (홈 Today's Pick·Nearby 카드 → 진입)
// 상태바 영역은 홈과 동일한 스카이블루 그라데이션으로 남기고 그 아래부터 화면 구성.
// 이미지는 여러 장 슬라이드(place-lookup photosName), 리뷰는 지도 시트와 동일한
// 공용 PlaceReviewsSection. Directions는 우리 지도 탭으로 이동해 경로까지 연결.
import { useQuery } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, Share, ScrollView, StyleSheet, Text, View } from 'react-native'
import { CachedImage } from '@/components/CachedImage'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Icon, Pill } from '@/components/brand'
import { PlaceThumb } from '@/components/PlaceThumb'
import { useFavorites, useToggleFavorite } from '@/features/favorites/queries'
import { PlaceReviewsSection } from '@/features/review/PlaceReviewsSection'
import { usePlaceReviews } from '@/features/review/queries'
import { useLocaleStore, useT } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { palette } from '@/theme/tokens'

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

  // 평점 표시용 — 리뷰 본문은 공용 PlaceReviewsSection이 담당(동일 쿼리라 중복 호출 없음)
  const reviewTarget = useMemo(() => ({ id: extId, name, lat, lng }), [extId, name, lat, lng])
  const { data: reviews } = usePlaceReviews(reviewTarget, lang)
  const rating = reviews?.rating != null ? String(reviews.rating) : (p.rating ?? '4.7')

  // 장소 사진 여러 장 (이미지 슬라이드) — 전달받은 대표 이미지 + Google Places 사진
  const [heroW, setHeroW] = useState(0)
  const [heroIdx, setHeroIdx] = useState(0)
  const { data: morePhotos } = useQuery({
    queryKey: ['place-photos', extId],
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const { data } = await supabase.functions.invoke('place-lookup', {
        body: { photosName: `${name} Busan` },
      })
      return (data?.urls ?? []) as string[]
    },
  })
  const heroImages = useMemo(() => {
    const all = [img, ...(morePhotos ?? [])].filter((u): u is string => !!u)
    return [...new Set(all)]
  }, [img, morePhotos])

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
        <View onLayout={(e) => setHeroW(e.nativeEvent.layout.width)}>
          {heroImages.length > 0 ? (
            <>
              {/* 이미지 슬라이드 — 좌우 스와이프로 여러 장 (기존 180 높이 형식 유지) */}
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) =>
                  heroW > 0 && setHeroIdx(Math.round(e.nativeEvent.contentOffset.x / heroW))
                }>
                {heroImages.map((u) => (
                  <CachedImage
                    key={u}
                    source={{ uri: u }}
                    style={{ width: heroW || '100%', height: 180 }}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              {heroImages.length > 1 && (
                <View style={ss.heroDots} pointerEvents="none">
                  {heroImages.map((u, i) => (
                    <View key={u} style={[ss.heroDot, i === heroIdx && ss.heroDotOn]} />
                  ))}
                </View>
              )}
            </>
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

          {/* ── 리뷰 — 지도 시트와 동일한 공용 섹션(AI 요약·출처 카드 필터·번역 토글) ── */}
          <View style={{ marginTop: 14 }}>
            <PlaceReviewsSection target={reviewTarget} />
          </View>
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
  // 이미지 슬라이드 인디케이터
  heroDots: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.55)',
  },
  heroDotOn: { backgroundColor: '#fff', width: 14 },
})
