// CouTix — 쿠폰 + 티켓 통합 화면(PLANNING §6 "티켓/쿠폰 지갑"). 상단 세그먼트로 전환.
import { useQuery } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon, Pill } from '@/components/brand'
import { FallbackBadge } from '@/components/FallbackBadge'
import { PlaceThumb } from '@/components/PlaceThumb'
import { track } from '@/features/analytics/service'
import { useCoupons, type CouponCard } from '@/features/coupon/queries'
import { getTickets, type Ticket } from '@/features/ticket/services'
import { useRequireAccount } from '@/features/auth/loginPrompt'
import { useT } from '@/lib/i18n'
import { USE_MOCK } from '@/lib/config'
import { palette, shadows } from '@/theme/tokens'

type Seg = 'coupons' | 'tickets'

// 세그먼트별 헤더 그라데이션 — 쿠폰(coral)/티켓(blue·teal)
const HEADER_GRAD: Record<Seg, [string, string, string]> = {
  coupons: ['#FB923C', '#F97316', '#EA580C'],
  tickets: ['#0EA5E9', '#0284C7', '#0D9488'],
}

// ===== 쿠폰 =====
// 실데이터(CouponCard)와 mock(number id)을 함께 수용
type Coupon = Omit<CouponCard, 'id'> & { id: string | number }

const COUPON_ITEMS: Coupon[] = [
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

const COUPON_FILTERS = [
  { id: 'all', key: 'coupon.all' },
  { id: 'food', key: 'coupon.food' },
  { id: 'cafe', key: 'coupon.cafe' },
  { id: 'beauty', key: 'coupon.beauty' },
  { id: 'activity', key: 'coupon.activity' },
]

// ===== 티켓 =====
const TICKET_FILTERS = [
  { id: 'all', key: 'ticket.all' },
  { id: 'attraction', key: 'ticket.attraction' },
  { id: 'tour', key: 'ticket.tour' },
  { id: 'show', key: 'ticket.show' },
  { id: 'transport', key: 'ticket.transport' },
]

const TICKET_CAT_KEY: Record<string, string> = {
  attraction: 'ticket.attraction',
  tour: 'ticket.tour',
  show: 'ticket.show',
  transport: 'ticket.transport',
}

export default function CouTixScreen() {
  const t = useT()
  const requireAccount = useRequireAccount()
  const params = useLocalSearchParams<{ seg?: string }>()
  const [seg, setSeg] = useState<Seg>(params.seg === 'tickets' ? 'tickets' : 'coupons')
  const [couponFilter, setCouponFilter] = useState('all')
  const [ticketFilter, setTicketFilter] = useState('all')

  const { data: dbCoupons, isLoading: couponsLoading } = useCoupons()
  const { data: ticketData } = useQuery({ queryKey: ['tickets'], queryFn: getTickets })

  // ----- 쿠폰 데이터(실데이터 없으면 mock 폴백) -----
  const couponSource: Coupon[] = dbCoupons?.length ? dbCoupons : COUPON_ITEMS
  const couponIsMock = !dbCoupons?.length
  const couponShown =
    couponFilter === 'all' ? couponSource : couponSource.filter((i) => i.filter === couponFilter)

  // ----- 티켓 데이터 -----
  const ticketShown = useMemo(() => {
    const list = ticketData ?? []
    return ticketFilter === 'all' ? list : list.filter((x) => x.category === ticketFilter)
  }, [ticketData, ticketFilter])

  // 퍼널 계측(REQ-CP-4): 목록 노출 — 로드 완료 후 세그먼트 단위 1회 (is_mock 정확도)
  useEffect(() => {
    if (seg === 'coupons' && couponsLoading) return
    track('coupon_list_view', {
      seg,
      count: seg === 'coupons' ? couponSource.length : (ticketData ?? []).length,
      is_mock: seg === 'coupons' ? couponIsMock : USE_MOCK,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seg, couponsLoading])

  // 쿠폰 저장(QR 발급)은 계정 귀속 — Guest면 로그인 유도 후 이어서 발급 (BACKLOG #8)
  const openCoupon = (c: Coupon) => {
    track('coupon_tap', {
      coupon_id: String(c.id),
      name: c.name,
      cat: c.filter,
      is_mock: couponIsMock,
    })
    requireAccount('auth.gateCoupon', () =>
      router.push({
        pathname: '/coupon-qr',
        params: { id: String(c.id), name: c.name, disc: c.disc },
      }),
    )
  }
  const bookTicket = (x: Ticket) => {
    track('ticket_outlink', { ticket_id: String(x.id), category: x.category })
    Linking.openURL(x.outlinkUrl).catch(() => {})
  }
  const ticketPrice = (x: Ticket) => `₩${x.price.toLocaleString()}`

  const isMock = seg === 'coupons' ? couponIsMock : USE_MOCK
  const filters = seg === 'coupons' ? COUPON_FILTERS : TICKET_FILTERS
  const activeFilter = seg === 'coupons' ? couponFilter : ticketFilter
  const setActiveFilter = seg === 'coupons' ? setCouponFilter : setTicketFilter
  const accent = seg === 'coupons' ? palette.coral[50] : palette.blue[50]

  return (
    <View style={ss.container}>
      {/* 헤더 — 세그먼트별 색 전환 */}
      <LinearGradient
        colors={HEADER_GRAD[seg]}
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
              <Text style={ss.headerTitle}>CouTix</Text>
              <View style={ss.headerLoc}>
                <Icon name="location_on" size={13} color="#fff" filled />
                <Text style={ss.headerLocText}>
                  {seg === 'coupons'
                    ? `Haeundae · ${couponSource.length} ${t('coupon.available')}`
                    : t('coupon.brandSub')}
                </Text>
              </View>
            </View>
            {isMock && <FallbackBadge label="Sample" />}
            {/* 화면 닫기(X) — 다른 화면과 동일하게 상단 우측 제공 */}
            <Pressable onPress={() => router.back()} hitSlop={8} style={ss.closeBtn}>
              <Icon name="close" size={18} color="#fff" />
            </Pressable>
          </View>

          {/* 세그먼트 토글 — 쿠폰 / 티켓 */}
          <View style={ss.segWrap}>
            {(['coupons', 'tickets'] as Seg[]).map((s) => {
              const on = s === seg
              return (
                <Pressable key={s} onPress={() => setSeg(s)} style={[ss.segBtn, on && ss.segBtnOn]}>
                  <Text style={[ss.segText, { color: on ? accent : '#fff' }]}>
                    {t(s === 'coupons' ? 'coupon.segCoupons' : 'coupon.segTickets')}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {/* 필터 칩 */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, marginTop: 12 }}>
            {filters.map((f) => {
              const on = f.id === activeFilter
              const count =
                seg === 'coupons'
                  ? f.id === 'all'
                    ? couponSource.length
                    : couponSource.filter((i) => i.filter === f.id).length
                  : null
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setActiveFilter(f.id)}
                  style={[ss.filterChip, on && ss.filterChipOn]}>
                  <Text style={[ss.filterText, { color: on ? accent : '#fff' }]}>
                    {t(f.key)}
                    {count != null && <Text style={{ opacity: 0.7 }}> {count}</Text>}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      {/* 리스트 */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10 }}>
        {seg === 'coupons'
          ? couponShown.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => openCoupon(c)}
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
                  <Text style={[ss.cardDisc, { color: palette.coral[50] }]}>{c.disc}</Text>
                  <Text style={ss.cardNote}>{c.note}</Text>
                </View>
              </Pressable>
            ))
          : ticketShown.map((x) => (
              <View key={x.id} style={[ss.card, shadows.card]}>
                <View style={ss.cardThumbLg}>
                  <PlaceThumb category={x.thumb} height={64} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.cardName}>{x.title}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
                    <Pill tone="blue" size="xs">
                      {t(TICKET_CAT_KEY[x.category])}
                    </Pill>
                    <Pill tone="neutral" size="xs">
                      {x.provider}
                    </Pill>
                  </View>
                  <Text style={ss.ticketPrice}>{ticketPrice(x)}</Text>
                </View>
                <Pressable onPress={() => bookTicket(x)} style={ss.bookBtn}>
                  <Icon name="open_in_new" size={14} color="#fff" filled />
                  <Text style={ss.bookText}>{t('ticket.book')}</Text>
                </Pressable>
              </View>
            ))}
        {seg === 'tickets' && <Text style={ss.outlinkNote}>{t('ticket.outlink')}</Text>}
      </ScrollView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  header: { paddingHorizontal: 18, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  // 세그먼트 토글
  segWrap: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,.18)',
    borderRadius: 999,
    padding: 4,
  },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 999,
  },
  segBtnOn: { backgroundColor: '#fff' },
  segText: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
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
  cardThumbLg: { width: 64, height: 64, borderRadius: 14, overflow: 'hidden' },
  cardName: { fontSize: 14, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.1 },
  cardDetail: { fontSize: 11, color: palette.zinc[500], marginTop: 1 },
  cardDisc: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  cardNote: { fontSize: 10, color: palette.zinc[500], marginTop: 2 },
  ticketPrice: { fontSize: 14, fontWeight: '800', color: palette.blue[50], marginTop: 6 },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.blue[50],
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    ...shadows.blue,
  },
  bookText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  outlinkNote: { fontSize: 11, color: palette.zinc[400], textAlign: 'center', marginTop: 6 },
})
