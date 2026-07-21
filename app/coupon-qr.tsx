// 쿠폰 QR 발급 화면 — CouTix 쿠폰 색(coral·orange) 그라데이션 헤더(퀵 타일 상세와 동일 패턴).
// QR은 로컬 캐시 우선 표시(즉시) + 없을 때만 서버 발급(콜드스타트 체감 제거).
// 여백에는 매장 정보 카드(실사진 썸네일·주소·거리)와 길찾기 버튼 제공.
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { CachedImage } from '@/components/CachedImage'
import { SafeAreaView } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'

import { Icon } from '@/components/brand'
import { FallbackBadge } from '@/components/FallbackBadge'
import { PlaceThumb } from '@/components/PlaceThumb'
import { track } from '@/features/analytics/service'
import { getCachedIssue, issueCoupon, type CouponIssue } from '@/features/coupon/services'
import { storage } from '@/lib/mmkv'
import { supabase } from '@/lib/supabase'
import { useLocaleStore } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

function useCountdown(expiresAt?: string) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (!expiresAt) return
    const tick = () =>
      setLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [expiresAt])
  return left
}

// 매장 위치 정보 (place-lookup query 모드) — 주소·좌표·카테고리
type Merchant = {
  address: string | null
  lat: number | null
  lng: number | null
  cat: string
  placeId: string
} | null

export default function CouponQrScreen() {
  const p = useLocalSearchParams<{
    id?: string
    name?: string
    disc?: string
    detail?: string
    dist?: string
  }>()
  const couponId = p.id ?? 'demo'
  const lang = useLocaleStore((s) => s.lang)
  // 캐시된 유효 발급분이 있으면 QR 즉시 표시 — 서버 왕복 없이 0ms 렌더
  const [issue, setIssue] = useState<CouponIssue | null>(() => getCachedIssue(couponId))
  const [loading, setLoading] = useState(!issue)
  const [photo, setPhoto] = useState<string | null>(
    () => storage.getString(`dealphoto:${p.name ?? ''}`) || null,
  )
  const [merchant, setMerchant] = useState<Merchant>(null)

  // 퍼널 계측(REQ-CP-4): 발급 성공 — 오프라인 폴백 여부 구분
  const trackIssued = (r: CouponIssue, reissued: boolean, cached = false) =>
    track('coupon_qr_issued', {
      coupon_id: couponId,
      issue_id: r.id,
      offline: r.id === 'offline',
      reissue: reissued,
      cached,
    })

  const reissue = async () => {
    setLoading(true)
    setIssue(null)
    const r = await issueCoupon(couponId)
    trackIssued(r, true)
    setIssue(r)
    setLoading(false)
  }

  useEffect(() => {
    // 마운트: 캐시가 유효하면 그대로 사용(재발급 불필요 — one-time 토큰은 만료 전까지 유효),
    // 없을 때만 서버 발급. (effect 내 동기 setState 회피 — await 후 setState)
    let alive = true
    const cached = getCachedIssue(couponId)
    if (cached) {
      trackIssued(cached, false, true)
    } else {
      issueCoupon(couponId).then((r) => {
        if (!alive) return
        trackIssued(r, false)
        setIssue(r)
        setLoading(false)
      })
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 매장 정보 — 실사진(홈 딜과 같은 7일 캐시) + 주소·좌표(place-lookup query)
  useEffect(() => {
    if (!p.name) return
    let alive = true
    if (!photo) {
      supabase.functions
        .invoke('place-lookup', { body: { photoName: `${p.name} Busan` } })
        .then(({ data }) => {
          if (!alive || !data?.url) return
          storage.set(`dealphoto:${p.name}`, data.url)
          setPhoto(data.url)
        })
        .catch(() => {})
    }
    supabase.functions
      .invoke('place-lookup', { body: { query: `${p.name} Busan`, lang } })
      .then(({ data }) => {
        if (!alive || !data?.name || data?.lat == null) return
        setMerchant({
          address: data.address ?? null,
          lat: data.lat,
          lng: data.lng,
          cat: data.cat ?? 'sights',
          placeId: data.placeId,
        })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.name])

  // 길찾기 — 지도 탭에 포커스 + 경로 표시 (place 상세의 Directions와 동일 계약)
  const openDirections = () => {
    if (!merchant?.lat) return
    track('coupon_directions', { coupon_id: couponId })
    router.replace({
      pathname: '/(tabs)/map',
      params: {
        fId: `g:${merchant.placeId}`,
        fName: p.name ?? '',
        fLat: String(merchant.lat),
        fLng: String(merchant.lng),
        fCat: merchant.cat,
        nav: '1',
      },
    })
  }

  const left = useCountdown(issue?.expires_at)
  const expired = !!issue && left <= 0
  const mm = String(Math.floor(left / 60)).padStart(1, '0')
  const secs = String(left % 60).padStart(2, '0')

  return (
    <View style={ss.container}>
      {/* 헤더 — CouTix 쿠폰 그라데이션(coral·orange)이 상태바 영역까지 */}
      <LinearGradient
        colors={['#FB923C', '#F97316', '#EA580C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={ss.gheader}>
            <View style={ss.gheaderIcon}>
              <Icon name="qr_code" size={20} color="#fff" filled />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.gheaderTitle} numberOfLines={1}>
                {p.name ?? 'Coupon'}
              </Text>
              <Text style={ss.gheaderSub}>Show this QR to staff · one-time use</Text>
            </View>
            <Pressable onPress={() => router.back()} style={ss.gclose}>
              <Icon name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={ss.body} showsVerticalScrollIndicator={false}>
        {/* QR 카드 */}
        <View style={[ss.card, shadows.pop]}>
          {p.disc && <Text style={ss.disc}>{p.disc}</Text>}
          <View style={ss.qrBox}>
            {loading ? (
              <Text style={ss.dim}>Issuing…</Text>
            ) : expired ? (
              <View style={{ alignItems: 'center', gap: 10 }}>
                <Icon name="schedule" size={40} color={palette.zinc[400]} />
                <Text style={ss.dim}>QR expired</Text>
              </View>
            ) : (
              // 디자인 QR — 중앙 브랜드 로고 + 고보정(ecl H, 로고 가림 복원)
              <QRCode
                value={issue?.qr_token ?? 'x'}
                size={200}
                backgroundColor="#fff"
                color="#1C1917"
                ecl="H"
                logo={require('../assets/icon.png')}
                logoSize={44}
                logoBackgroundColor="#fff"
                logoBorderRadius={10}
                logoMargin={3}
              />
            )}
          </View>

          {!loading && !expired && (
            <View style={ss.timer}>
              <Icon name="schedule" size={14} color={palette.coral[50]} />
              <Text style={ss.timerText}>
                Expires in {mm}:{secs}
              </Text>
            </View>
          )}
          {!loading && issue?.id === 'offline' && (
            <FallbackBadge
              label="Offline QR · not verified"
              style={{ alignSelf: 'center', marginTop: 8 }}
            />
          )}
          <Text style={ss.offline}>Works offline · valid for 5 minutes after issue</Text>
        </View>

        {/* 매장 정보 카드 — 실사진 썸네일 + 상세·거리·주소 + 길찾기 */}
        <View style={[ss.merchant, shadows.card]}>
          <View style={ss.thumb}>
            {photo ? (
              <CachedImage source={{ uri: photo }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <PlaceThumb category={merchant?.cat ?? 'market'} height={64} />
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={ss.mName} numberOfLines={1}>
              {p.name ?? 'Partner store'}
            </Text>
            {!!p.detail && (
              <Text style={ss.mDetail} numberOfLines={1}>
                {p.detail}
              </Text>
            )}
            <View style={ss.mMetaRow}>
              {!!p.dist && (
                <>
                  <Icon name="location_on" size={12} color={palette.coral[50]} filled />
                  <Text style={ss.mMeta}>{p.dist}</Text>
                </>
              )}
              {!!merchant?.address && (
                <Text style={ss.mMeta} numberOfLines={1}>
                  {p.dist ? ' · ' : ''}
                  {merchant.address}
                </Text>
              )}
            </View>
          </View>
          {merchant?.lat != null && (
            <Pressable onPress={openDirections} style={ss.dirBtn}>
              <Icon name="navigation" size={16} color="#fff" filled />
            </Pressable>
          )}
        </View>

        <Pressable onPress={reissue} style={ss.reissue}>
          <Icon name="qr_code" size={18} color="#fff" filled />
          <Text style={ss.reissueText}>{expired ? 'Re-issue QR' : 'Refresh QR'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  // 그라데이션 헤더 — 퀵 타일 상세(gheader)와 동일 패턴
  gheader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  gheaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gheaderTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  gheaderSub: { color: 'rgba(255,255,255,.85)', fontSize: 11.5, marginTop: 2 },
  gclose: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  disc: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.coral[50],
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  qrBox: {
    width: 232,
    height: 232,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.coral[90],
  },
  dim: { fontSize: 14, color: palette.zinc[400] },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 16 },
  timerText: { fontSize: 13, fontWeight: '700', color: palette.coral[50] },
  offline: { fontSize: 11, color: palette.zinc[400], marginTop: 8, textAlign: 'center' },
  // 매장 정보 카드
  merchant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    width: '100%',
  },
  thumb: { width: 64, height: 64, borderRadius: 14, overflow: 'hidden' },
  mName: { fontSize: 15, fontWeight: '800', color: palette.zinc[900] },
  mDetail: { fontSize: 12, color: palette.zinc[500] },
  mMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, paddingRight: 8 },
  mMeta: { fontSize: 11.5, color: palette.zinc[500], flexShrink: 1 },
  dirBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: palette.blue[50],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blue,
  },
  reissue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.blue[50],
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignSelf: 'center',
    ...shadows.blue,
  },
  reissueText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
