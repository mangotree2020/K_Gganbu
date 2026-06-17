import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon, Pill } from '@/components/brand'
import { FallbackBadge } from '@/components/FallbackBadge'
import { PlaceThumb } from '@/components/PlaceThumb'
import { useCoupons, type CouponCard } from '@/features/coupon/queries'
import { useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

// 실데이터(CouponCard)와 mock(number id)을 함께 수용
type Coupon = Omit<CouponCard, 'id'> & { id: string | number }

const ITEMS: Coupon[] = [
  {
    id: 1,
    name: 'Halmae Gukbap',
    cat: 'Food',
    icon: 'food',
    detail: 'Traditional Korean soup',
    dist: '380m',
    disc: '10% OFF',
    note: 'Today only',
    filter: 'food',
  },
  {
    id: 2,
    name: 'Bada View Cafe',
    cat: 'Cafe',
    icon: 'cafe',
    detail: 'Ocean-view coffee shop',
    dist: '520m',
    disc: 'Free drink',
    note: '2+ orders',
    filter: 'cafe',
  },
  {
    id: 3,
    name: 'Glow K-Beauty',
    cat: 'Beauty',
    icon: 'spa',
    detail: 'Facial · skincare',
    dist: '1.1km',
    disc: '₩5,000',
    note: 'OFF',
    filter: 'beauty',
  },
  {
    id: 4,
    name: 'Songdo Cable Car',
    cat: 'Activity',
    icon: 'cable',
    detail: 'Aerial gondola',
    dist: '4.3km',
    disc: '15% OFF',
    note: 'Foreigner',
    filter: 'activity',
  },
  {
    id: 5,
    name: 'Jagalchi Street Food',
    cat: 'Food',
    icon: 'market',
    detail: 'Local seafood & snacks',
    dist: '6.8km',
    disc: 'Free item',
    note: 'With order',
    filter: 'food',
  },
  {
    id: 6,
    name: 'Haeundae Spa Land',
    cat: 'Beauty',
    icon: 'spa',
    detail: 'Korean jjimjilbang',
    dist: '1.4km',
    disc: '30% OFF',
    note: 'Weekday',
    filter: 'beauty',
  },
]

const FILTERS = [
  { id: 'all', key: 'coupon.all' },
  { id: 'food', key: 'coupon.food' },
  { id: 'cafe', key: 'coupon.cafe' },
  { id: 'beauty', key: 'coupon.beauty' },
  { id: 'activity', key: 'coupon.activity' },
]

export default function CouponsScreen() {
  const t = useT()
  const [filter, setFilter] = useState('all')
  const { data: dbCoupons } = useCoupons()
  // 실데이터 없으면 mock 폴백 (네트워크/빈 DB)
  const source: Coupon[] = dbCoupons?.length ? dbCoupons : ITEMS
  const isMock = !dbCoupons?.length
  const shown = filter === 'all' ? source : source.filter((i) => i.filter === filter)

  return (
    <View style={ss.container}>
      {/* 헤더 */}
      <LinearGradient
        colors={['#FB923C', '#F97316', '#EA580C']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={ss.header}>
        <SafeAreaView edges={['top']}>
          <View style={ss.headerRow}>
            <View style={ss.headerIconBox}>
              <Text style={{ fontSize: 22 }}>🎟</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.headerTitle}>{t('coupon.title')}</Text>
              <View style={ss.headerLoc}>
                <Icon name="location_on" size={13} color="#fff" filled />
                <Text style={ss.headerLocText}>
                  Haeundae · {source.length} {t('coupon.available')}
                </Text>
              </View>
            </View>
            {isMock && <FallbackBadge label="Sample" />}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, marginTop: 14 }}>
            {FILTERS.map((f) => {
              const on = f.id === filter
              const count =
                f.id === 'all' ? source.length : source.filter((i) => i.filter === f.id).length
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  style={[ss.filterChip, on && ss.filterChipOn]}>
                  <Text style={[ss.filterText, { color: on ? palette.coral[50] : '#fff' }]}>
                    {t(f.key)} <Text style={{ opacity: 0.7 }}>{count}</Text>
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      {/* 쿠폰 리스트 */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10 }}>
        {shown.map((c) => (
          <Pressable
            key={c.id}
            onPress={() =>
              router.push({
                pathname: '/coupon-qr',
                params: { id: String(c.id), name: c.name, disc: c.disc },
              })
            }
            style={({ pressed }) => [ss.card, shadows.card, { opacity: pressed ? 0.9 : 1 }]}>
            <View style={ss.cardThumb}>
              <PlaceThumb category={c.icon} height={56} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.cardName}>{c.name}</Text>
              <Text style={ss.cardDetail}>{c.detail}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
                {!!c.dist && <Pill tone="neutral" size="xs">{`📍 ${c.dist}`}</Pill>}
                <Pill tone="blue" size="xs">
                  {c.cat}
                </Pill>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={ss.cardDisc}>{c.disc}</Text>
              <Text style={ss.cardNote}>{c.note}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  header: { paddingHorizontal: 18, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8 },
  headerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  headerLoc: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  headerLocText: { fontSize: 12, color: 'rgba(255,255,255,.94)' },
  filterChip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.4)',
    backgroundColor: 'rgba(255,255,255,.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  filterChipOn: { backgroundColor: '#fff' },
  filterText: { fontSize: 12, fontWeight: '700' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  cardThumb: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden' },
  cardName: { fontSize: 14, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.1 },
  cardDetail: { fontSize: 11, color: palette.zinc[500], marginTop: 1 },
  cardDisc: { fontSize: 15, fontWeight: '800', color: palette.coral[50], letterSpacing: -0.2 },
  cardNote: { fontSize: 10, color: palette.zinc[500], marginTop: 2 },
})
