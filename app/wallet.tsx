// Travel Wallet (PLANNING §16 "쿠폰함(Travel Wallet) — My 탭 내 쿠폰·티켓 지갑")
// 소유 콘텐츠(발급 쿠폰 QR·구매 티켓 바우처)를 한 지갑에서 보관·사용.
// 샵(CouTix 탭)과 역할 분리: 샵 = 탐색·구매, 지갑 = 소유·사용. 빈 상태는 샵으로 크로스셀.
// 티켓은 인앱 결제(REQ-PAY-1) 전까지 실 소유 데이터가 없어 빈 상태 CTA가 기본.
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon, Pill } from '@/components/brand'
import { PlaceThumb } from '@/components/PlaceThumb'
import { SheetHeader } from '@/components/SheetHeader'
import { useCoupons, useUserCoupons } from '@/features/coupon/queries'
import { getMyTickets } from '@/features/ticket/services'
import { useT } from '@/lib/i18n'
import { palette } from '@/theme/tokens'

const STATUS_TONE: Record<string, 'success' | 'neutral' | 'coral'> = {
  issued: 'success',
  active: 'success',
  used: 'neutral',
  expired: 'coral',
  revoked: 'coral',
}

type Seg = 'coupons' | 'tickets'

export default function WalletScreen() {
  const t = useT()
  const params = useLocalSearchParams<{ seg?: string }>()
  const [seg, setSeg] = useState<Seg>(params.seg === 'tickets' ? 'tickets' : 'coupons')
  const { data: coupons, isLoading } = useUserCoupons()
  const { data: myTickets } = useQuery({ queryKey: ['my-tickets'], queryFn: getMyTickets })
  // 쿠폰 카탈로그 조인 — 사용처 설명·거리 표시용 (couponId 매칭)
  const { data: catalog } = useCoupons()

  // 동일 쿠폰 수량 합산 — couponId 기준 그룹, 사용 가능(issued) 우선 대표
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { rep: typeof coupons extends (infer U)[] | undefined ? U : never; count: number }
    >()
    for (const c of coupons ?? []) {
      const cur = map.get(c.couponId)
      if (!cur) map.set(c.couponId, { rep: c, count: 1 })
      else {
        cur.count += 1
        if (cur.rep.status !== 'issued' && c.status === 'issued') cur.rep = c
      }
    }
    return [...map.values()]
  }, [coupons])
  const infoFor = (couponId: string) => catalog?.find((k) => String(k.id) === couponId)

  return (
    <View style={ss.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <SheetHeader
          title={t('wallet.title')}
          sub={t('wallet.sub')}
          icon="wallet"
          accent={palette.coral[50]}
          accentBg={palette.coral[95]}
        />

        {/* 세그먼트 — 쿠폰 / 티켓 (소유 수 표시) */}
        <View style={ss.segWrap}>
          {(['coupons', 'tickets'] as Seg[]).map((s) => {
            const on = s === seg
            const count = s === 'coupons' ? (coupons?.length ?? 0) : (myTickets?.length ?? 0)
            return (
              <Pressable key={s} onPress={() => setSeg(s)} style={[ss.segBtn, on && ss.segBtnOn]}>
                <Text style={[ss.segText, on && { color: palette.coral[50] }]}>
                  {t(s === 'coupons' ? 'coupon.segCoupons' : 'coupon.segTickets')}
                  {count > 0 ? ` ${count}` : ''}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {seg === 'coupons' ? (
            isLoading ? (
              <Text style={ss.dim}>{t('common.loading')}</Text>
            ) : !coupons?.length ? (
              <View style={ss.empty}>
                <Icon name="confirmation_number" size={40} color={palette.zinc[300]} />
                <Text style={ss.emptyText}>{t('savedCoupon.empty')}</Text>
                <Text style={ss.emptySub}>{t('savedCoupon.emptySub')}</Text>
                {/* 빈 지갑 → 샵 크로스셀 (막다른 화면 금지) */}
                <Pressable
                  onPress={() => router.push('/(tabs)/coupons' as never)}
                  style={ss.shopBtn}>
                  <Icon name="storefront" size={15} color="#fff" filled />
                  <Text style={ss.shopBtnText}>{t('wallet.browseShop')}</Text>
                </Pressable>
              </View>
            ) : (
              grouped.map(({ rep: c, count }) => {
                const info = infoFor(c.couponId)
                return (
                  <Pressable
                    key={c.couponId}
                    onPress={() =>
                      router.push({
                        pathname: '/coupon-qr',
                        params: {
                          id: c.couponId,
                          name: c.name,
                          disc: c.disc,
                          detail: info?.detail ?? '',
                          dist: info?.dist ?? '',
                        },
                      })
                    }
                    android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                    style={[ss.card]}>
                    <View style={ss.thumb}>
                      <PlaceThumb category={info?.icon ?? c.category} height={52} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ss.name} numberOfLines={1}>
                        {c.name}
                      </Text>
                      {/* 사용처·조건 — 카탈로그 조인 (설명 + 거리) */}
                      {(info?.detail || info?.dist) && (
                        <Text style={ss.detail} numberOfLines={1}>
                          {info?.detail}
                          {info?.dist ? ` · 📍 ${info.dist}` : ''}
                        </Text>
                      )}
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
                        <Pill tone={STATUS_TONE[c.status] ?? 'neutral'} size="xs">
                          {t(`status.${c.status}`)}
                        </Pill>
                        {count > 1 && (
                          <Pill tone="blue" size="xs">
                            ×{count}
                          </Pill>
                        )}
                      </View>
                    </View>
                    <Text style={ss.disc}>{c.disc}</Text>
                  </Pressable>
                )
              })
            )
          ) : !myTickets?.length ? (
            <View style={ss.empty}>
              <Icon name="local_activity" size={40} color={palette.zinc[300]} />
              <Text style={ss.emptyText}>{t('wallet.ticketsEmpty')}</Text>
              <Text style={ss.emptySub}>{t('wallet.ticketsEmptySub')}</Text>
              <Pressable
                onPress={() => router.push('/(tabs)/coupons?seg=tickets' as never)}
                style={ss.shopBtn}>
                <Icon name="storefront" size={15} color="#fff" filled />
                <Text style={ss.shopBtnText}>{t('wallet.browseTickets')}</Text>
              </Pressable>
            </View>
          ) : (
            myTickets.map((tk) => (
              <View key={tk.id} style={ss.card}>
                <View style={ss.thumb}>
                  <PlaceThumb category="cable" height={52} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.name} numberOfLines={1}>
                    {tk.title}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
                    <Pill tone={STATUS_TONE[tk.status] ?? 'neutral'} size="xs">
                      {t(`status.${tk.status}`)}
                    </Pill>
                    <Pill tone="neutral" size="xs">
                      {tk.voucher}
                    </Pill>
                  </View>
                </View>
                <Text style={ss.disc}>₩{tk.price.toLocaleString()}</Text>
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
  segWrap: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 16,
    backgroundColor: palette.zinc[100],
    borderRadius: 999,
    padding: 4,
  },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 999,
  },
  segBtnOn: { backgroundColor: '#fff' },
  segText: { fontSize: 13, fontWeight: '800', color: palette.zinc[500], letterSpacing: -0.2 },
  dim: { fontSize: 14, color: palette.zinc[400], textAlign: 'center', marginTop: 40 },
  empty: { alignItems: 'center', gap: 8, marginTop: 64, paddingHorizontal: 32 },
  emptyText: { fontSize: 16, fontWeight: '700', color: palette.zinc[600] },
  emptySub: { fontSize: 13, color: palette.zinc[400], textAlign: 'center' },
  shopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.coral[50],
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 8,
  },
  shopBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
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
  detail: { fontSize: 11.5, color: palette.zinc[500], marginTop: 2 },
  disc: { fontSize: 15, fontWeight: '800', color: palette.coral[50] },
})
