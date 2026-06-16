import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'

import { Icon } from '@/components/brand'
import { issueCoupon, type CouponIssue } from '@/features/coupon/services'
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

export default function CouponQrScreen() {
  const p = useLocalSearchParams<{ id?: string; name?: string; disc?: string }>()
  const couponId = p.id ?? 'demo'
  const [issue, setIssue] = useState<CouponIssue | null>(null)
  const [loading, setLoading] = useState(true)

  const reissue = async () => {
    setLoading(true)
    const r = await issueCoupon(couponId)
    setIssue(r)
    setLoading(false)
  }

  useEffect(() => {
    // 마운트 시 1회 발급 (effect 내 동기 setState 회피 — await 후 setState)
    let alive = true
    issueCoupon(couponId).then((r) => {
      if (!alive) return
      setIssue(r)
      setLoading(false)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const left = useCountdown(issue?.expires_at)
  const expired = !!issue && left <= 0
  const mm = String(Math.floor(left / 60)).padStart(1, '0')
  const secs = String(left % 60).padStart(2, '0')

  return (
    <View style={ss.container}>
      <SafeAreaView edges={['top']}>
        <View style={ss.header}>
          <View style={{ flex: 1 }}>
            <Text style={ss.title}>{p.name ?? 'Coupon'}</Text>
            <Text style={ss.sub}>Show this QR to staff · one-time use</Text>
          </View>
          <Pressable onPress={() => router.back()} style={ss.close}>
            <Icon name="close" size={18} color={palette.zinc[700]} />
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={ss.body}>
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
              <QRCode
                value={issue?.qr_token ?? 'x'}
                size={200}
                backgroundColor="#fff"
                color={palette.zinc[900]}
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
          <Text style={ss.offline}>Works offline · valid for 5 minutes after issue</Text>
        </View>

        <Pressable
          onPress={reissue}
          style={({ pressed }) => [ss.reissue, { opacity: pressed ? 0.9 : 1 }]}>
          <Icon name="qr_code" size={18} color="#fff" filled />
          <Text style={ss.reissueText}>{expired ? 'Re-issue QR' : 'Refresh QR'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.zinc[200],
  },
  title: { fontSize: 17, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.3 },
  sub: { fontSize: 12, color: palette.zinc[500], marginTop: 1 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
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
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  dim: { fontSize: 14, color: palette.zinc[400] },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 16 },
  timerText: { fontSize: 13, fontWeight: '700', color: palette.coral[50] },
  offline: { fontSize: 11, color: palette.zinc[400], marginTop: 8, textAlign: 'center' },
  reissue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.blue[50],
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    ...shadows.blue,
  },
  reissueText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
