// CouTix — 쿠폰 + 티켓 통합 화면(PLANNING §6 "티켓/쿠폰 지갑"). 상단 세그먼트로 전환.
import { useQuery } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { CachedImage } from '@/components/CachedImage'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon, Pill } from '@/components/brand'
import { FallbackBadge } from '@/components/FallbackBadge'
import { PlaceThumb } from '@/components/PlaceThumb'
import { track } from '@/features/analytics/service'
import { useCouponPhotos } from '@/features/coupon/photos'
import { useCoupons, type CouponCard } from '@/features/coupon/queries'
import {
  getGifticonCatalog,
  pointUsableFor,
  productName,
  type GifticonProduct,
} from '@/features/gifticon/services'
import { useWalkRank } from '@/features/journey/queries'
import { usePointsSummary, type PointsEntry } from '@/features/points/queries'
import { routePayment } from '@/features/payment/router'
import { getTickets, saveMyTicket, type Ticket } from '@/features/ticket/services'
import { useAuthStore } from '@/features/auth/store'
import { useLoginPrompt, useRequireAccount } from '@/features/auth/loginPrompt'
import { useTabBarAutoHide } from '@/hooks/useTabBarAutoHide'
import { useLocaleStore, useT } from '@/lib/i18n'
import { USE_MOCK } from '@/lib/config'
import { palette, shadows } from '@/theme/tokens'

type Seg = 'coupons' | 'tickets' | 'points'

// 세그먼트별 헤더 그라데이션 — 쿠폰(coral)/티켓(blue·teal)/포인트(amber)
const HEADER_GRAD: Record<Seg, [string, string, string]> = {
  coupons: ['#FB923C', '#F97316', '#EA580C'],
  tickets: ['#0EA5E9', '#0284C7', '#0D9488'],
  points: ['#FBBF24', '#F59E0B', '#D97706'],
}

const SEG_KEY: Record<Seg, string> = {
  coupons: 'coupon.segCoupons',
  tickets: 'coupon.segTickets',
  points: 'coupon.segPoints',
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
  // 스크롤 방향 따라 하단 탭바 자동 숨김/표시
  const tabBarAutoHide = useTabBarAutoHide()
  const t = useT()
  const requireAccount = useRequireAccount()
  const params = useLocalSearchParams<{ seg?: string }>()
  const [seg, setSeg] = useState<Seg>(
    params.seg === 'tickets' || params.seg === 'points' ? params.seg : 'coupons',
  )
  // 탭이 이미 마운트된 상태에서 딥링크(?seg=)로 재진입해도 세그먼트가 정확히 전환되도록
  // (렌더 중 상태 조정 패턴 — 이펙트 setState의 연쇄 렌더 회피)
  const [prevParamSeg, setPrevParamSeg] = useState(params.seg)
  if (params.seg !== prevParamSeg) {
    setPrevParamSeg(params.seg)
    if (params.seg === 'tickets' || params.seg === 'points' || params.seg === 'coupons') {
      setSeg(params.seg)
    }
  }
  const [couponFilter, setCouponFilter] = useState('all')
  const [ticketFilter, setTicketFilter] = useState('all')

  const { data: dbCoupons, isLoading: couponsLoading } = useCoupons()
  const { data: ticketData } = useQuery({ queryKey: ['tickets'], queryFn: getTickets })

  // ----- 쿠폰 데이터(실데이터 없으면 mock 폴백) -----
  const couponSource: Coupon[] = dbCoupons?.length ? dbCoupons : COUPON_ITEMS
  const couponIsMock = !dbCoupons?.length
  const couponShown =
    couponFilter === 'all' ? couponSource : couponSource.filter((i) => i.filter === couponFilter)
  // 쿠폰 실사진 썸네일 — 홈 딜과 동일 캐시(dealphoto:) 공유
  const couponPhotos = useCouponPhotos(couponSource.map((c) => c.name))

  // ----- 티켓 데이터 -----
  const ticketShown = useMemo(() => {
    const list = ticketData ?? []
    return ticketFilter === 'all' ? list : list.filter((x) => x.category === ticketFilter)
  }, [ticketData, ticketFilter])

  // 퍼널 계측(REQ-CP-4): 목록 노출 — 로드 완료 후 세그먼트 단위 1회 (is_mock 정확도)
  useEffect(() => {
    if (seg === 'points') return // 포인트 홈은 실데이터 전용 — 쿠폰 퍼널 계측 제외
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
        // 매장 정보 카드(썸네일·거리) 표시용 부가 파라미터 포함
        params: { id: String(c.id), name: c.name, disc: c.disc, detail: c.detail, dist: c.dist },
      }),
    )
  }
  const bookTicket = (x: Ticket) => {
    track('ticket_outlink', { ticket_id: String(x.id), category: x.category })
    Linking.openURL(x.outlinkUrl).catch(() => {})
  }
  // 인앱 구매 (REQ-PAY-1 병행 동선) — payment-router 경유(미연동 시 mock 폴백),
  // 결제 완료 시 Travel Wallet에 바우처 적재. 계정 귀속이라 게스트는 로그인 유도.
  const buyTicket = (x: Ticket) => {
    requireAccount('auth.gateCoupon', () => {
      Alert.alert(x.title, `₩${x.price.toLocaleString()}`, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('ticket.buyInApp'),
          onPress: async () => {
            track('ticket_buy_inapp', { ticket_id: String(x.id), amount: x.price })
            const pay = await routePayment({
              ticketId: x.id,
              amount: x.price,
              currency: 'KRW',
              method: 'card',
            })
            if (pay.status !== 'paid') {
              Alert.alert(t('ticket.buyFailed'))
              return
            }
            await saveMyTicket({
              id: x.id,
              title: x.title,
              category: x.category,
              price: x.price,
              purchasedAt: new Date().toISOString(),
              voucher: pay.pgTxId ?? pay.id,
              status: 'active',
            })
            Alert.alert(t('ticket.purchased'), '', [
              { text: t('common.ok'), style: 'cancel' },
              {
                text: t('ticket.viewWallet'),
                onPress: () => router.push('/wallet?seg=tickets' as never),
              },
            ])
          },
        },
      ])
    })
  }
  const ticketPrice = (x: Ticket) => `₩${x.price.toLocaleString()}`

  const isMock = seg === 'coupons' ? couponIsMock : seg === 'tickets' ? USE_MOCK : false
  const filters = seg === 'coupons' ? COUPON_FILTERS : seg === 'tickets' ? TICKET_FILTERS : []
  const activeFilter = seg === 'coupons' ? couponFilter : ticketFilter
  const setActiveFilter = seg === 'coupons' ? setCouponFilter : setTicketFilter
  const accent =
    seg === 'coupons' ? palette.coral[50] : seg === 'tickets' ? palette.blue[50] : palette.amber[50]

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

          {/* 세그먼트 토글 — 쿠폰 / 티켓 / 포인트 */}
          <View style={ss.segWrap}>
            {(['coupons', 'tickets', 'points'] as Seg[]).map((s) => {
              const on = s === seg
              return (
                <Pressable key={s} onPress={() => setSeg(s)} style={[ss.segBtn, on && ss.segBtnOn]}>
                  <Text style={[ss.segText, { color: on ? accent : '#fff' }]}>{t(SEG_KEY[s])}</Text>
                </Pressable>
              )
            })}
          </View>

          {/* 필터 칩 (포인트 세그먼트는 필터 없음) */}
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
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10 }}
        {...tabBarAutoHide}>
        {seg === 'points' && <PointsSection />}
        {seg === 'coupons'
          ? couponShown.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => openCoupon(c)}
                style={({ pressed }) => [ss.card, shadows.card, { opacity: pressed ? 0.9 : 1 }]}>
                <View style={ss.cardThumb}>
                  {couponPhotos[c.name] ? (
                    <CachedImage
                      source={{ uri: couponPhotos[c.name] as string }}
                      style={{ width: 56, height: 56 }}
                    />
                  ) : (
                    <PlaceThumb category={c.icon} height={56} />
                  )}
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
          : seg === 'tickets'
            ? ticketShown.map((x) => (
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
                  <View style={{ gap: 6 }}>
                    {/* 자체 구매 — 지갑 보관 (mock-first, PG 연동 시 실결제) */}
                    <Pressable onPress={() => buyTicket(x)} style={[ss.bookBtn, ss.buyBtn]}>
                      <Icon name="wallet" size={14} color="#fff" filled />
                      <Text style={ss.bookText}>{t('ticket.buyInApp')}</Text>
                    </Pressable>
                    {/* 외부 예매 — 기존 아웃링크 병행 */}
                    <Pressable onPress={() => bookTicket(x)} style={ss.bookBtn}>
                      <Icon name="open_in_new" size={14} color="#fff" filled />
                      <Text style={ss.bookText}>{t('ticket.book')}</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            : null}
        {seg === 'tickets' && <Text style={ss.outlinkNote}>{t('ticket.outlink')}</Text>}
      </ScrollView>
    </View>
  )
}

// ===== 포인트 홈 (REQ-PT-4) — 잔액·소멸 예정·최근 내역. 게스트는 적립 불가 → 로그인 유도 =====
const KIND_KEY: Record<PointsEntry['kind'], string> = {
  earn: 'points.kind.earn',
  spend: 'points.kind.spend',
  expire: 'points.kind.expire',
  revert: 'points.kind.revert',
}

function PointsSection() {
  const t = useT()
  const lang = useLocaleStore((s) => s.lang)
  const user = useAuthStore((s) => s.user)
  const showLogin = useLoginPrompt((s) => s.show)
  const isGuest = !user || user.isGuest
  const { data } = usePointsSummary()
  // 기프트샵 카탈로그 (REQ-GS-1 mock-first) — 기프티쇼 계약 후 실 카탈로그로 교체
  const { data: catalog } = useQuery({
    queryKey: ['gifticon-catalog'],
    queryFn: getGifticonCatalog,
  })
  // 걷기 랭킹 (REQ-LOC-4) — 길찾기 이동거리 최근 7일, 마스킹 닉네임 집계만
  const { data: walkRank } = useWalkRank(7)

  // 게스트 — 포인트가 핵심 가입 트리거 (REQ-PT-4)
  if (isGuest) {
    return (
      <Pressable onPress={() => showLogin('auth.gatePoints')} style={[ps.guestCard, shadows.card]}>
        <Text style={{ fontSize: 36 }}>🪙</Text>
        <Text style={ps.guestTitle}>{t('points.guestCta')}</Text>
        <Text style={ps.guestSub}>{t('points.emptySub')}</Text>
        <View style={ps.guestBtn}>
          <Text style={ps.guestBtnText}>{t('auth.gateTitle')}</Text>
          <Icon name="chevron_right" size={15} color="#fff" />
        </View>
      </Pressable>
    )
  }

  const balance = data?.balance ?? 0
  const expiring = data?.expiring_30d ?? 0
  const history = data?.history ?? []

  return (
    <View style={{ gap: 10 }}>
      {/* 잔액 카드 */}
      <LinearGradient
        colors={['#FBBF24', '#F59E0B', '#D97706']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[ps.balanceCard, shadows.card]}>
        <Text style={ps.balanceLabel}>{t('points.balance')}</Text>
        <Text style={ps.balanceValue}>{balance.toLocaleString()}P</Text>
        {expiring > 0 && (
          <View style={ps.expiringPill}>
            <Icon name="schedule" size={12} color="#92400E" />
            <Text style={ps.expiringText}>
              {t('points.expiring30d').replace('{n}', expiring.toLocaleString())}
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* 기프트샵 (REQ-GS-1·2 골격) — 계약 전이라 구매 비활성(오픈 예정), 혼합 결제 30% 안내 */}
      {(catalog?.products?.length ?? 0) > 0 && (
        <View style={[ps.giftBox, shadows.card]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={ps.giftTitle}>{t('points.giftShop')}</Text>
            <Pill tone="amber" size="xs">
              {t('points.comingSoon')}
            </Pill>
          </View>
          <Text style={ps.giftSub}>{t('points.giftShopSub')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginTop: 10 }}>
            {(catalog?.products ?? []).map((g: GifticonProduct) => (
              <View key={g.id} style={ps.giftCard}>
                <Text style={{ fontSize: 26 }}>{g.emoji}</Text>
                <Text style={ps.giftBrand} numberOfLines={1}>
                  {g.brand}
                </Text>
                <Text style={ps.giftName} numberOfLines={1}>
                  {productName(g, lang)}
                </Text>
                <Text style={ps.giftPrice}>₩{g.price.toLocaleString()}</Text>
                <Text style={ps.giftUsable}>
                  {t('points.usable').replace('{n}', pointUsableFor(g.price).toLocaleString())}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 스탬프 투어 (REQ-ST-1) — 매장 QR 스캔 적립 진입 */}
      <Pressable
        onPress={() => router.push('/stamp-scan' as never)}
        style={[ps.stampBtn, shadows.card]}>
        <Text style={{ fontSize: 22 }}>🔖</Text>
        <View style={{ flex: 1 }}>
          <Text style={ps.stampTitle}>{t('stamp.title')}</Text>
          <Text style={ps.giftSub}>{t('stamp.scanCta')}</Text>
        </View>
        <Icon name="chevron_right" size={18} color={palette.zinc[400]} />
      </Pressable>

      {/* 걷기 랭킹 (REQ-LOC-4) — 길찾기 이동거리 순위, 만보기·포인트 경제와 연동되는 리텐션 장치 */}
      <View style={[ps.giftBox, shadows.card]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={ps.giftTitle}>🏆 {t('points.walkRank')}</Text>
        </View>
        <Text style={ps.giftSub}>{t('points.walkRankSub')}</Text>
        {(walkRank?.length ?? 0) === 0 ? (
          <Text style={[ps.guestSub, { marginTop: 10 }]}>{t('points.walkRankEmpty')}</Text>
        ) : (
          <View style={{ marginTop: 10, gap: 8 }}>
            {(walkRank ?? []).slice(0, 5).map((r) => (
              <View key={`${r.rank}-${r.display_name}`} style={ps.rankRow}>
                <Text style={ps.rankNum}>{r.rank}</Text>
                <Text style={[ps.rankName, r.is_me && { color: palette.amber[50] }]}>
                  {r.is_me ? t('points.me') : r.display_name}
                </Text>
                <Text style={ps.rankDist}>{(r.total_m / 1000).toFixed(1)}km</Text>
              </View>
            ))}
            {/* 내가 Top 5 밖이면 내 순위를 하단에 표시 */}
            {(walkRank ?? []).some((r) => r.is_me && r.rank > 5) &&
              (walkRank ?? [])
                .filter((r) => r.is_me && r.rank > 5)
                .map((r) => (
                  <View key="me" style={[ps.rankRow, { opacity: 0.9 }]}>
                    <Text style={ps.rankNum}>{r.rank}</Text>
                    <Text style={[ps.rankName, { color: palette.amber[50] }]}>
                      {t('points.me')}
                    </Text>
                    <Text style={ps.rankDist}>{(r.total_m / 1000).toFixed(1)}km</Text>
                  </View>
                ))}
          </View>
        )}
      </View>

      {/* 적립·사용 내역 */}
      {history.length === 0 ? (
        <View style={[ps.emptyBox, shadows.card]}>
          <Text style={{ fontSize: 30 }}>👣</Text>
          <Text style={ps.emptyTitle}>{t('points.empty')}</Text>
          <Text style={ps.guestSub}>{t('points.emptySub')}</Text>
        </View>
      ) : (
        history.map((e) => (
          <View key={e.id} style={[ps.entryRow, shadows.card]}>
            <View style={{ flex: 1 }}>
              <Text style={ps.entryTitle}>
                {t(KIND_KEY[e.kind])} · {t(`points.source.${e.source}`)}
              </Text>
              <Text style={ps.entryDate}>{e.created_at.slice(0, 10)}</Text>
            </View>
            <Text
              style={[
                ps.entryAmount,
                { color: e.amount > 0 ? palette.amber[50] : palette.zinc[500] },
              ]}>
              {e.amount > 0 ? '+' : ''}
              {e.amount.toLocaleString()}P
            </Text>
          </View>
        ))
      )}
    </View>
  )
}

const ps = StyleSheet.create({
  guestCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  guestTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.zinc[900],
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  guestSub: { fontSize: 12, color: palette.zinc[500], textAlign: 'center' },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: palette.amber[50],
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 6,
  },
  guestBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  balanceCard: { borderRadius: 20, padding: 20, gap: 4 },
  balanceLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,.9)' },
  balanceValue: { fontSize: 34, fontWeight: '800', color: '#fff', letterSpacing: -0.6 },
  expiringPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: palette.amber[90],
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  expiringText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: palette.zinc[900] },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  entryTitle: { fontSize: 13, fontWeight: '700', color: palette.zinc[900] },
  entryDate: { fontSize: 11, color: palette.zinc[400], marginTop: 2 },
  entryAmount: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  giftBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  giftTitle: { fontSize: 14, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.2 },
  giftSub: { fontSize: 11, color: palette.zinc[500], marginTop: 2 },
  giftCard: {
    width: 116,
    backgroundColor: palette.zinc[50],
    borderRadius: 14,
    padding: 10,
    gap: 2,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    opacity: 0.9,
  },
  giftBrand: { fontSize: 10, fontWeight: '700', color: palette.zinc[400], marginTop: 4 },
  giftName: { fontSize: 12, fontWeight: '700', color: palette.zinc[900] },
  giftPrice: { fontSize: 13, fontWeight: '800', color: palette.zinc[900], marginTop: 2 },
  giftUsable: { fontSize: 10, fontWeight: '700', color: palette.amber[50] },
  stampBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  stampTitle: { fontSize: 14, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.2 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankNum: { width: 20, fontSize: 13, fontWeight: '800', color: palette.zinc[400] },
  rankName: { flex: 1, fontSize: 13, fontWeight: '700', color: palette.zinc[900] },
  rankDist: { fontSize: 13, fontWeight: '800', color: palette.zinc[900] },
})

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
  buyBtn: { backgroundColor: palette.coral[50] },
  outlinkNote: { fontSize: 11, color: palette.zinc[400], textAlign: 'center', marginTop: 6 },
})
