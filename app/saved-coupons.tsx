// 저장한 쿠폰 (BACKLOG #23 My탭) — 발급받은 쿠폰(coupon_issues) 목록, QR 재표시
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon, Pill } from '@/components/brand'
import { PlaceThumb } from '@/components/PlaceThumb'
import { SheetHeader } from '@/components/SheetHeader'
import { useUserCoupons } from '@/features/coupon/queries'
import { useT } from '@/lib/i18n'
import { palette } from '@/theme/tokens'

const STATUS_TONE: Record<string, 'success' | 'neutral' | 'coral'> = {
  issued: 'success',
  used: 'neutral',
  expired: 'coral',
  revoked: 'coral',
}

export default function SavedCouponsScreen() {
  const t = useT()
  const { data: coupons, isLoading } = useUserCoupons()

  return (
    <View style={ss.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={ss.headerRow}>
          <View style={{ flex: 1 }}>
            <SheetHeader
              title={t('savedCoupon.title')}
              sub={t('savedCoupon.sub')}
              icon="confirmation_number"
              accent={palette.coral[50]}
              accentBg={palette.coral[95]}
            />
          </View>
          <Pressable onPress={() => router.back()} style={ss.close}>
            <Icon name="close" size={18} color={palette.zinc[700]} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {isLoading ? (
            <Text style={ss.dim}>{t('common.loading')}</Text>
          ) : !coupons?.length ? (
            <View style={ss.empty}>
              <Icon name="confirmation_number" size={40} color={palette.zinc[300]} />
              <Text style={ss.emptyText}>{t('savedCoupon.empty')}</Text>
              <Text style={ss.emptySub}>{t('savedCoupon.emptySub')}</Text>
            </View>
          ) : (
            coupons.map((c) => (
              <Pressable
                key={c.id}
                onPress={() =>
                  router.push({
                    pathname: '/coupon-qr',
                    params: { id: c.couponId, name: c.name, disc: c.disc },
                  })
                }
                style={({ pressed }) => [ss.card, { opacity: pressed ? 0.9 : 1 }]}>
                <View style={ss.thumb}>
                  <PlaceThumb category={c.category} height={52} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.name} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <View style={{ flexDirection: 'row', marginTop: 5 }}>
                    <Pill tone={STATUS_TONE[c.status] ?? 'neutral'} size="xs">
                      {t(`status.${c.status}`)}
                    </Pill>
                  </View>
                </View>
                <Text style={ss.disc}>{c.disc}</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  disc: { fontSize: 15, fontWeight: '800', color: palette.coral[50] },
})
