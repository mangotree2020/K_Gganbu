// 딱지치기 (PRD REQ-GM-1) — 전통놀이 미니게임 프로토타입.
// 규칙: 좌우로 왕복하는 파워 게이지를 탭해 힘을 정한다. 가운데(정타)에 가까울수록 성공 확률이 높다.
//   성공하면 상대 딱지가 뒤집히고 연승이 쌓이며, 라운드마다 난이도(게이지 속도·필요 정확도)가 오른다.
// 보상: 승리 시 earn_game(+10P, 일 상한 30P는 서버 캡). 최종 점수는 game_scores 에 기록해 랭킹·뱃지에 반영.
//
// IP 가드레일(REQ-GM-3): 전통놀이 자체는 퍼블릭 도메인이며 드라마 IP 요소(명칭·비주얼·상징물)는 쓰지 않는다.
// 시각 요소는 종이 딱지 이모지와 브랜드 팔레트만 사용한다.
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { SheetHeader } from '@/components/SheetHeader'
import { useSubmitScore } from '@/features/game/queries'
import { shareGameResult } from '@/features/game/share'
import { useT } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { palette, shadows } from '@/theme/tokens'

const BAR_W = 260 // 게이지 폭(px)
const HIT_BASE = 46 // 1라운드 성공 판정 폭(가운데 기준 ±)
const HIT_MIN = 16 // 라운드가 올라가도 이보다 좁아지지는 않는다(운 게임이 되지 않도록)

export default function DdakjiScreen() {
  const t = useT()
  const submitScore = useSubmitScore()

  const [round, setRound] = useState(1)
  const [score, setScore] = useState(0)
  const [phase, setPhase] = useState<'ready' | 'result' | 'over'>('ready')
  const [lastHit, setLastHit] = useState<boolean | null>(null)
  const [earned, setEarned] = useState<number | null>(null)
  const rewardedRef = useRef(false)
  const submittedRef = useRef(false)

  // 게이지 — 왕복 애니메이션. 값은 0~1이며 0.5가 정타.
  const pos = useState(() => new Animated.Value(0))[0]
  const posRef = useRef(0)
  const flip = useState(() => new Animated.Value(0))[0]

  useEffect(() => {
    const id = pos.addListener(({ value }) => {
      posRef.current = value
    })
    return () => pos.removeListener(id)
  }, [pos])

  // 라운드가 오를수록 왕복이 빨라진다(1라운드 900ms → 최소 320ms)
  const sweepMs = Math.max(320, 900 - (round - 1) * 70)

  useEffect(() => {
    if (phase !== 'ready') return
    pos.setValue(0)
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pos, {
          toValue: 1,
          duration: sweepMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pos, {
          toValue: 0,
          duration: sweepMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [phase, round, sweepMs, pos])

  const hitWidth = Math.max(HIT_MIN, HIT_BASE - (round - 1) * 3)

  const strike = () => {
    if (phase !== 'ready') return
    const offset = Math.abs(posRef.current - 0.5) * BAR_W // 정타에서 벗어난 px
    const success = offset <= hitWidth / 2
    setLastHit(success)
    setPhase('result')

    if (success) {
      // 정타에 가까울수록 높은 점수(10~30)
      const acc = 1 - offset / (hitWidth / 2)
      const gain = 10 + Math.round(acc * 20)
      setScore((s) => s + gain)
      flip.setValue(0)
      Animated.timing(flip, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
      // 첫 성공 시 1회 포인트 적립(상한은 서버가 캡)
      if (!rewardedRef.current) {
        rewardedRef.current = true
        supabase.functions
          .invoke('points', { body: { action: 'earn_game' } })
          .then(({ data }) => {
            if (data?.granted > 0) setEarned(data.granted)
          })
          .catch(() => {})
      }
    }
  }

  const next = () => {
    if (lastHit) {
      setRound((r) => r + 1)
      setPhase('ready')
      return
    }
    setPhase('over')
  }

  // 종료 시 점수 1회 기록(랭킹·뱃지 반영)
  useEffect(() => {
    if (phase !== 'over' || submittedRef.current) return
    submittedRef.current = true
    submitScore.mutate({ game: 'ddakji', score })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const restart = () => {
    setRound(1)
    setScore(0)
    setLastHit(null)
    setPhase('ready')
    submittedRef.current = false
  }

  const markerLeft = pos.interpolate({ inputRange: [0, 1], outputRange: [0, BAR_W - 6] })
  const flipRotate = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })

  return (
    <SafeAreaView style={ss.container} edges={['top']}>
      <SheetHeader
        title={`🟨 ${t('game.ddakji')}`}
        sub={`${t('game.round')} ${round} · ${t('game.score')} ${score}`}
        icon="stadia_controller"
        accent={palette.amber[50]}
        accentBg={palette.amber[90]}
      />

      <View style={ss.body}>
        {/* 딱지 — 성공 시 뒤집히는 애니메이션 */}
        <Animated.Text style={[ss.ddakji, { transform: [{ rotate: flipRotate }] }]}>
          {lastHit === false && phase !== 'ready' ? '🟫' : '🟨'}
        </Animated.Text>

        {phase === 'ready' && (
          <>
            <Text style={ss.hint}>{t('game.ddakjiHint')}</Text>
            {/* 파워 게이지 — 가운데 초록 구간이 성공 판정 */}
            <View style={[ss.bar, shadows.card]}>
              <View style={[ss.hitZone, { width: hitWidth, left: (BAR_W - hitWidth) / 2 }]} />
              <Animated.View style={[ss.marker, { left: markerLeft }]} />
            </View>
            <Pressable onPress={strike} style={[ss.strikeBtn, shadows.card]}>
              <Text style={ss.strikeText}>{t('game.strike')}</Text>
            </Pressable>
          </>
        )}

        {phase === 'result' && (
          <View style={ss.resultBox}>
            <Text style={ss.resultTitle}>
              {lastHit ? t('game.ddakjiHit') : t('game.ddakjiMiss')}
            </Text>
            {earned != null && <Text style={ss.earned}>+{earned}P</Text>}
            <Pressable onPress={next} style={ss.strikeBtn}>
              <Text style={ss.strikeText}>{lastHit ? t('game.nextRound') : t('game.finish')}</Text>
            </Pressable>
          </View>
        )}

        {phase === 'over' && (
          <View style={ss.resultBox}>
            <Text style={{ fontSize: 34 }}>🎌</Text>
            <Text style={ss.resultTitle}>
              {t('game.score')} {score}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={restart} style={ss.strikeBtn}>
                <Text style={ss.strikeText}>{t('game.retry')}</Text>
              </Pressable>
              <Pressable
                onPress={() => shareGameResult(t('game.ddakji'), score, t)}
                style={[ss.strikeBtn, { backgroundColor: palette.teal[40] }]}>
                <Text style={ss.strikeText}>{t('game.share')}</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={ss.exitText}>{t('game.exit')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 20 },
  ddakji: { fontSize: 76 },
  hint: { fontSize: 13, color: palette.zinc[600], textAlign: 'center' },
  bar: {
    width: BAR_W,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  hitZone: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: 10,
    backgroundColor: palette.success[90],
  },
  marker: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    width: 6,
    borderRadius: 3,
    backgroundColor: palette.coral[50],
  },
  strikeBtn: {
    backgroundColor: palette.amber[50],
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  strikeText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  resultBox: { alignItems: 'center', gap: 12 },
  resultTitle: { fontSize: 18, fontWeight: '800', color: palette.zinc[900] },
  earned: { fontSize: 16, fontWeight: '800', color: palette.amber[50] },
  exitText: { fontSize: 13, color: palette.zinc[500], marginTop: 4 },
})
