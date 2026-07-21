// 즐겨찾기 목록 (BACKLOG #20) — 저장한 장소 조회/길찾기/삭제
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { CachedImage } from '@/components/CachedImage'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { PlaceThumb } from '@/components/PlaceThumb'
import { SheetHeader } from '@/components/SheetHeader'
import { useFavorites, useToggleFavorite, type FavoriteRow } from '@/features/favorites/queries'
import { useT } from '@/lib/i18n'
import { palette } from '@/theme/tokens'

export default function FavoritesScreen() {
  const t = useT()
  const { data: favorites, isLoading } = useFavorites()
  const toggleFav = useToggleFavorite()

  // 길찾기 — 우리 지도 탭으로 (장소 시트 선택 + 도보 경로까지, map.tsx focus 파라미터)
  const openDirections = (f: FavoriteRow) => {
    if (f.lat && f.lng) {
      router.push({
        pathname: '/(tabs)/map',
        params: {
          fId: f.place_ext_id,
          fName: f.name,
          fLat: String(f.lat),
          fLng: String(f.lng),
          fCat: f.cat ?? 'sights',
          nav: '1',
        },
      })
      return
    }
    router.push('/(tabs)/map' as never)
  }

  return (
    <View style={ss.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <SheetHeader
          title={t('fav.title')}
          sub={t('fav.subtitle')}
          icon="bookmark"
          accent={palette.coral[50]}
          accentBg={palette.coral[95]}
        />

        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {isLoading ? (
            <Text style={ss.dim}>{t('common.loading')}</Text>
          ) : !favorites?.length ? (
            <View style={ss.empty}>
              <Icon name="bookmark" size={40} color={palette.zinc[300]} />
              <Text style={ss.emptyText}>{t('fav.empty')}</Text>
              <Text style={ss.emptySub}>{t('fav.emptySub')}</Text>
            </View>
          ) : (
            favorites.map((f) => (
              <View key={f.id} style={ss.card}>
                <View style={ss.thumb}>
                  {f.image_url ? (
                    <CachedImage source={{ uri: f.image_url }} style={{ width: 52, height: 52 }} />
                  ) : (
                    <PlaceThumb category={f.cat ?? 'sights'} height={52} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.name} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text style={ss.addr} numberOfLines={1}>
                    {f.address ?? 'Busan'}
                  </Text>
                </View>
                <Pressable style={ss.dirBtn} onPress={() => openDirections(f)} hitSlop={6}>
                  <Icon name="navigation" size={18} color="#fff" filled />
                </Pressable>
                <Pressable
                  style={ss.removeBtn}
                  hitSlop={6}
                  onPress={() => toggleFav.mutate({ extId: f.place_ext_id, name: f.name })}>
                  <Icon name="delete" size={18} color={palette.coral[50]} />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  dim: { fontSize: 14, color: palette.zinc[400], textAlign: 'center', marginTop: 40 },
  empty: { alignItems: 'center', gap: 8, marginTop: 64, paddingHorizontal: 32 },
  emptyText: { fontSize: 16, fontWeight: '700', color: palette.zinc[600] },
  emptySub: { fontSize: 13, color: palette.zinc[400], textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 10,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  thumb: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden' },
  name: { fontSize: 15, fontWeight: '700', color: palette.zinc[900] },
  addr: { fontSize: 12.5, color: palette.zinc[500], marginTop: 1 },
  dirBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: palette.blue[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: palette.coral[95],
    alignItems: 'center',
    justifyContent: 'center',
  },
})
