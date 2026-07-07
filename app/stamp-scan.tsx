// 스탬프 스캔 (REQ-ST-1) — 제휴 매장 비치 QR 스캔 → 방문당 50P (일 3개 서버 캡)
// 후면 카메라 스캔, 성공/중복/상한/무효 상태를 오버레이로 안내. 게스트는 로그인 유도.
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { SheetHeader } from '@/components/SheetHeader'
import { useLoginPrompt } from '@/features/auth/loginPrompt'
import { useAuthStore } from '@/features/auth/store'
import { useCurrentLocation } from '@/hooks/useCurrentLocation'
import { useT } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { palette, shadows } from '@/theme/tokens'

type ScanState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'success'; partner: string; granted: number }
  | { kind: 'duplicate'; partner: string }
  | { kind: 'capped' }
  | { kind: 'invalid' }

export default function StampScanScreen() {
  const t = useT()
  const [perm, requestPerm] = useCameraPermissions()
  const user = useAuthStore((s) => s.user)
  const showLogin = useLoginPrompt((s) => s.show)
  const isGuest = !user || user.isGuest
  const { coords } = useCurrentLocation()
  const [state, setState] = useState<ScanState>({ kind: 'idle' })
  const busyRef = useRef(false)

  const onScan = async ({ data }: { data: string }) => {
    if (busyRef.current || state.kind === 'busy') return
    if (!data?.startsWith('KGBSTAMP:')) return // 다른 QR은 무시(연속 스캔 소음 방지)
    busyRef.current = true
    setState({ kind: 'busy' })
    try {
      const { data: res } = await supabase.functions.invoke('stamp', {
        body: { code: data, lat: coords?.latitude, lng: coords?.longitude },
      })
      if (res?.granted > 0)
        setState({ kind: 'success', partner: res.partnerName, granted: res.granted })
      else if (res?.duplicate) setState({ kind: 'duplicate', partner: res.partnerName ?? '' })
      else if (res?.capped) setState({ kind: 'capped' })
      else setState({ kind: 'invalid' })
    } catch {
      setState({ kind: 'invalid' })
    } finally {
      busyRef.current = false
    }
  }

  const again = () => setState({ kind: 'idle' })

  return (
    <SafeAreaView style={ss.container} edges={['top']}>
      <SheetHeader
        title={t('stamp.title')}
        sub={t('stamp.sub')}
        icon="approval"
        accent={palette.coral[50]}
        accentBg={palette.coral[95]}
      />
      <View style={{ flex: 1, padding: 16 }}>
        {isGuest ? (
          <View style={ss.center}>
            <Text style={{ fontSize: 40 }}>🔖</Text>
            <Text style={ss.msgTitle}>{t('points.guestCta')}</Text>
            <Pressable onPress={() => showLogin('auth.gatePoints')} style={ss.actionBtn}>
              <Text style={ss.actionText}>{t('auth.gateTitle')}</Text>
            </Pressable>
          </View>
        ) : !perm?.granted ? (
          <View style={ss.center}>
            <Text style={{ fontSize: 40 }}>📷</Text>
            <Pressable onPress={() => requestPerm()} style={ss.actionBtn}>
              <Text style={ss.actionText}>{t('game.grantCamera')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={ss.camWrap}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={state.kind === 'idle' ? onScan : undefined}
            />
            {/* 스캔 가이드 프레임 */}
            <View style={ss.overlay} pointerEvents="box-none">
              {state.kind === 'idle' && (
                <>
                  <View style={ss.frame} />
                  <Text style={ss.hint}>{t('stamp.hint')}</Text>
                </>
              )}
              {state.kind === 'busy' && <ActivityIndicator color="#fff" size="large" />}
              {state.kind !== 'idle' && state.kind !== 'busy' && (
                <View style={[ss.resultCard, shadows.card]}>
                  <Text style={{ fontSize: 40 }}>
                    {state.kind === 'success' ? '🎉' : state.kind === 'invalid' ? '🤔' : '✅'}
                  </Text>
                  {state.kind === 'success' && (
                    <>
                      <Text style={ss.msgTitle}>{state.partner}</Text>
                      <Text style={ss.earned}>+{state.granted}P</Text>
                    </>
                  )}
                  {state.kind === 'duplicate' && (
                    <Text style={ss.msgTitle}>{t('stamp.already')}</Text>
                  )}
                  {state.kind === 'capped' && <Text style={ss.msgTitle}>{t('stamp.capped')}</Text>}
                  {state.kind === 'invalid' && (
                    <Text style={ss.msgTitle}>{t('stamp.invalid')}</Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Pressable onPress={again} style={ss.actionBtn}>
                      <Text style={ss.actionText}>{t('stamp.scanMore')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => router.back()}
                      style={[ss.actionBtn, { backgroundColor: palette.zinc[200] }]}>
                      <Text style={[ss.actionText, { color: palette.zinc[700] }]}>
                        {t('game.exit')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  camWrap: { flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,.9)',
    borderRadius: 24,
  },
  hint: {
    marginTop: 14,
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,.6)',
    textShadowRadius: 8,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 24,
  },
  msgTitle: { fontSize: 16, fontWeight: '800', color: palette.zinc[900], textAlign: 'center' },
  earned: { fontSize: 20, fontWeight: '800', color: palette.amber[50] },
  actionBtn: {
    backgroundColor: palette.coral[50],
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 13 },
})
