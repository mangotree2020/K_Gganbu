// 쿠폰 QR 발급 화면 — CouTix 쿠폰 색(coral·orange) 그라데이션 헤더(퀵 타일 상세와 동일 패턴).
// QR은 로컬 캐시 우선 표시(즉시) + 없을 때만 서버 발급(콜드스타트 체감 제거).
// 여백에는 매장 정보 카드(실사진 썸네일·주소·거리)와 길찾기 버튼 제공.
import { LinearGradient } from 'expo-linear-gradient'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { CachedImage } from '@/components/CachedImage'
import { SafeAreaView } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'

import { Icon } from '@/components/brand'
import { FallbackBadge } from '@/components/FallbackBadge'
import { PlaceThumb } from '@/components/PlaceThumb'
import { track } from '@/features/analytics/service'
import { getCachedIssue, issueCoupon, type CouponIssue } from '@/features/coupon/services'
import * as ImagePicker from 'expo-image-picker'
import { addReview, uploadReviewPhoto } from '@/features/review/services'
import { markVisitReviewed, recordVisit } from '@/features/review/visits'
import { storage } from '@/lib/mmkv'
import { supabase } from '@/lib/supabase'
import { useProfileStore } from '@/features/profile/store'
import { useLocaleStore, useT } from '@/lib/i18n'
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
  const t = useT()
  const couponId = p.id ?? 'demo'
  const lang = useLocaleStore((s) => s.lang)
  // 캐시된 유효 발급분이 있으면 QR 즉시 표시 — 서버 왕복 없이 0ms 렌더
  const [issue, setIssue] = useState<CouponIssue | null>(() => getCachedIssue(couponId))
  const [loading, setLoading] = useState(!issue)
  const [photo, setPhoto] = useState<string | null>(
    () => storage.getString(`dealphoto:${p.name ?? ''}`) || null,
  )
  const [merchant, setMerchant] = useState<Merchant>(null)
  // 폴링 콜백에서 최신 매장 정보를 읽기 위한 미러(방문 기록에 좌표·카테고리를 함께 남긴다)
  const merchantRef = useRef<Merchant>(null)
  useEffect(() => {
    merchantRef.current = merchant
  }, [merchant])
  // 사용 완료 감지 (UX_REVIEW §4-4) — 매장에서 QR을 스캔하면 status가 'used'로 바뀐다.
  // 그 순간이 후기를 받기 가장 좋은 시점이라 1탭 별점을 띄운다(실후기 축적 = UGC의 전제).
  const [used, setUsed] = useState(false)
  const [rated, setRated] = useState<number | null>(null)
  // 피드 공개는 명시 동의가 있을 때만 — 기본은 비공개(가게에 남기는 평가에 가깝다)
  const [sharePublic, setSharePublic] = useState(false)
  const profileName = useProfileStore((s) => s.displayName) || 'Traveler'
  // 사진 첨부(선택) — 공개 후기에만 의미가 있어 공유 토글이 켜졌을 때 노출한다
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    if (!r.canceled && r.assets[0]?.uri) setPhotoUri(r.assets[0].uri)
  }

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

  // 사용 완료 폴링 — QR이 화면에 떠 있는 동안 8초마다 발급 상태 확인(본인 RLS 조회).
  // 매장 직원이 스캔하면 status='used'가 되고, 그 즉시 별점 요청을 띄운다.
  useEffect(() => {
    if (!issue?.id || used) return
    let alive = true
    const check = async () => {
      const { data } = await supabase
        .from('coupon_issues')
        .select('status')
        .eq('id', issue.id)
        .maybeSingle()
      if (alive && data?.status === 'used') {
        setUsed(true)
        // 매장 스캔 = 확실한 방문. 이 화면을 떠난 뒤에도 지갑에서 후기를 남길 수 있게 기록한다.
        recordVisit({
          placeKey: `coupon:${couponId}`,
          name: p.name ?? 'Place',
          cat: merchantRef.current?.cat,
          lat: merchantRef.current?.lat,
          lng: merchantRef.current?.lng,
          source: 'coupon',
          // 발급 id를 함께 남겨야 지갑·후기 대기 목록에서 써도 서버 중복 제약이 걸린다
          refId: issue?.id ?? null,
        })
      }
    }
    const timer = setInterval(check, 8000)
    void check()
    return () => {
      alive = false
      clearInterval(timer)
    }
    // couponId·p.name은 이 화면의 라우트 파라미터로 고정 — 폴링을 재시작할 이유가 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue?.id, used])

  // 별점 저장 — 1탭으로 끝난다(본문은 선택). 같은 사용 건은 서버 unique 가 중복을 막는다.
  const rate = async (n: number) => {
    setRated(n)
    try {
      // 사진은 부가 정보 — 업로드가 실패해도 후기는 저장한다
      const photoUrl = sharePublic && photoUri ? await uploadReviewPhoto(photoUri) : null
      const saved = await addReview({
        placeName: p.name ?? p.detail ?? 'Place',
        rating: n,
        cat: merchant?.cat,
        placeKey: merchant?.placeId ?? null,
        refId: issue?.id ?? null,
        isPublic: sharePublic,
        authorName: profileName,
        photos: photoUrl ? [photoUrl] : [],
      })
      // 세션이 없으면 addReview가 예외 대신 false를 준다 — 저장 안 된 걸 완료로 표시하면
      // 지갑의 후기 진입점까지 함께 사라진다. 별점을 되돌려 다시 누를 수 있게 둔다.
      if (!saved) {
        setRated(null)
        return
      }
      markVisitReviewed(`coupon:${couponId}`) // 지갑에서 같은 쿠폰을 다시 묻지 않도록
    } catch {
      setRated(null) // 실패 — 같은 자리에서 다시 시도할 수 있게 별점 초기화
    }
  }

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
          {/* 사용 완료 → 1탭 별점 (UX_REVIEW §4-4) — QR 자리를 그대로 후기 요청으로 바꾼다 */}
          {used ? (
            <View style={ss.ratingBox}>
              <Text style={{ fontSize: 34 }}>{rated ? '🙏' : '✅'}</Text>
              <Text style={ss.ratingTitle}>
                {rated ? t('review.thanks') : t('review.askTitle')}
              </Text>
              {!rated && <Text style={ss.dim}>{t('review.askSub')}</Text>}
              {!rated && (
                <>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Pressable key={n} onPress={() => rate(n)} hitSlop={6}>
                        <Icon name="star" size={30} color={palette.amber[50]} />
                      </Pressable>
                    ))}
                  </View>
                  {/* 피드 공개 동의 (REQ-UGC-2) — 끄면 나만 보는 기록으로 남는다 */}
                  <Pressable
                    onPress={() => setSharePublic((v) => !v)}
                    hitSlop={6}
                    style={ss.shareRow}>
                    <Icon
                      name={sharePublic ? 'check_circle' : 'circle'}
                      size={16}
                      color={sharePublic ? palette.success[50] : palette.zinc[400]}
                      filled={sharePublic}
                    />
                    <Text style={ss.shareText}>{t('review.shareToFeed')}</Text>
                  </Pressable>
                  {sharePublic && (
                    <Pressable onPress={pickPhoto} hitSlop={6} style={ss.shareRow}>
                      <Icon name="photo_camera" size={16} color={palette.blue[50]} />
                      <Text style={[ss.shareText, { color: palette.blue[50] }]}>
                        {photoUri ? t('review.photoAdded') : t('review.addPhoto')}
                      </Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>
          ) : (
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
          )}

          {!loading && !expired && !used && (
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
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  shareText: { fontSize: 12, color: palette.zinc[600] },
  ratingBox: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 18,
  },
  ratingTitle: { fontSize: 15, fontWeight: '800', color: palette.zinc[900], textAlign: 'center' },
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
