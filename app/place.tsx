import { router, useLocalSearchParams } from 'expo-router'
import { useMemo } from 'react'
import { Image, Linking, Pressable, Share, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Icon, Pill } from '@/components/brand'
import { PlaceThumb } from '@/components/PlaceThumb'
import { useFavorites, useToggleFavorite } from '@/features/favorites/queries'
import { useT } from '@/lib/i18n'
import { palette } from '@/theme/tokens'

export default function PlaceScreen() {
  const t = useT()
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
  const rating = p.rating ?? '4.7'
  const dist = p.dist ?? '380m'
  const img = p.img || null
  const lat = p.lat ? Number(p.lat) : null
  const lng = p.lng ? Number(p.lng) : null
  const extId = p.extId || `poi-${name}`
  const desc =
    p.desc ??
    "Beloved by locals for fresh, no-frills seafood. Try the seaside terrace — it's where Haeundae sunsets feel infinite."

  // 즐겨찾기 상태 (extId 기준)
  const { data: favorites } = useFavorites()
  const toggleFav = useToggleFavorite()
  const isFav = useMemo(
    () => (favorites ?? []).some((f) => f.place_ext_id === extId),
    [favorites, extId],
  )

  // 길찾기 — 좌표 있으면 목적지 좌표, 없으면 이름 검색으로 구글맵 열기
  const openDirections = () => {
    const url =
      lat != null && lng != null
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`
    Linking.openURL(url)
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
              <Text style={ss.metaText}>{rating}</Text>
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
})
