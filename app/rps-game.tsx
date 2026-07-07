// 가위바위보 (My → Game) — AI 깐부와 3판 선승, 승리 시 게임존 입장(+포인트)
// 모드 2종: ① 탭 선택 ② 카메라 AR 대결 — 셀피(전면) 라이브 프리뷰 위에서 3·2·1
// 카운트다운(AI 손이 흔들리다 '보!'에 공개) → 그 순간 프레임 캡처 → rps-vision 판독.
// 전통놀이 게임존(REQ-GM)은 후속 — 승리 화면이 그 입구가 된다. 승리 적립은
// points Edge Function earn_game(승리 10P, 일 상한 30P 서버 강제 — challenge·game 공유).
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { SheetHeader } from '@/components/SheetHeader'
import { useT } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { palette, shadows } from '@/theme/tokens'

type Hand = 'rock' | 'paper' | 'scissors'
type Mode = 'tap' | 'camera'
const HANDS: Hand[] = ['rock', 'paper', 'scissors']
const EMOJI: Record<Hand, string> = { rock: '✊', paper: '✋', scissors: '✌️' }
const WIN_TARGET = 3

// AI 손 무작위 선택 — 이벤트 핸들러 전용(렌더 밖)
const randomHand = (): Hand => HANDS[Math.floor(Math.random() * 3)]

// 나의 손 vs AI 손 → 1(승) / 0(무) / -1(패)
function judge(me: Hand, ai: Hand): number {
  if (me === ai) return 0
  const beats: Record<Hand, Hand> = { rock: 'scissors', paper: 'rock', scissors: 'paper' }
  return beats[me] === ai ? 1 : -1
}

export default function RpsGameScreen() {
  const t = useT()
  const [mode, setMode] = useState<Mode>('tap')
  const [myScore, setMyScore] = useState(0)
  const [aiScore, setAiScore] = useState(0)
  const [round, setRound] = useState<{ me: Hand; ai: Hand; result: number } | null>(null)
  const [unknownHand, setUnknownHand] = useState(false)
  const [earned, setEarned] = useState<number | null>(null)

  const finished = myScore >= WIN_TARGET || aiScore >= WIN_TARGET
  const won = myScore >= WIN_TARGET

  const playRound = async (me: Hand) => {
    if (finished) return
    const ai = randomHand()
    const result = judge(me, ai)
    setRound({ me, ai, result })
    const nextMy = myScore + (result === 1 ? 1 : 0)
    if (result === 1) setMyScore(nextMy)
    if (result === -1) setAiScore((s) => s + 1)
    // 3승 달성 — 포인트 적립(로그인 시, 실패 무시)
    if (nextMy >= WIN_TARGET && result === 1) {
      try {
        const { data } = await supabase.functions.invoke('points', {
          body: { action: 'earn_game' },
        })
        if (data?.granted > 0) setEarned(data.granted)
      } catch {
        // 게스트·상한·오프라인 — 조용히
      }
    }
  }

  // ── 카메라 AR 대결 — 셀피 프리뷰 위 카운트다운 → '보!' 순간 캡처 → Gemini 판독 ──
  const camRef = useRef<CameraView>(null)
  const [perm, requestPerm] = useCameraPermissions()
  const [camPhase, setCamPhase] = useState<'idle' | 'count' | 'reading'>('idle')
  const [count, setCount] = useState(3)
  const [aiShake, setAiShake] = useState('✊') // 카운트다운 중 AI 손 흔들기(빠른 순환)
  const timersRef = useRef<ReturnType<typeof setInterval>[]>([])

  useEffect(
    () => () => {
      timersRef.current.forEach(clearInterval)
    },
    [],
  )

  const startDuel = () => {
    if (camPhase !== 'idle' || finished) return
    setUnknownHand(false)
    setRound(null)
    setCamPhase('count')
    setCount(3)
    // AI 손 흔들기 — 150ms 순환 (실제 상대가 '가위~바위~' 흔드는 연출)
    const shake = setInterval(
      () => setAiShake(randomHand() === 'rock' ? '✊' : randomHand() === 'paper' ? '✋' : '✌️'),
      150,
    )
    timersRef.current.push(shake)
    let c = 3
    const tick = setInterval(() => {
      c -= 1
      if (c > 0) {
        setCount(c)
        return
      }
      clearInterval(tick)
      clearInterval(shake)
      void captureAndJudge()
    }, 800)
    timersRef.current.push(tick)
  }

  const captureAndJudge = async () => {
    setCamPhase('reading')
    try {
      const pic = await camRef.current?.takePictureAsync({
        base64: true,
        quality: 0.25,
        skipProcessing: true,
      })
      if (!pic?.base64) {
        setUnknownHand(true)
        return
      }
      const { data } = await supabase.functions.invoke('rps-vision', {
        body: { imageBase64: pic.base64 },
      })
      const hand = data?.hand as Hand | 'unknown'
      if (hand === 'unknown' || !HANDS.includes(hand as Hand)) {
        setUnknownHand(true)
        return
      }
      await playRound(hand as Hand)
    } catch {
      setUnknownHand(true)
    } finally {
      setCamPhase('idle')
    }
  }

  const reset = () => {
    setMyScore(0)
    setAiScore(0)
    setRound(null)
    setEarned(null)
    setUnknownHand(false)
  }

  return (
    <SafeAreaView style={ss.container} edges={['top']}>
      <SheetHeader
        title={t('game.title')}
        sub={t('game.sub')}
        icon="smart_toy"
        accent={palette.blue[50]}
        accentBg={palette.blue[95]}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {/* 모드 토글 */}
        <View style={ss.segWrap}>
          {(['tap', 'camera'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[ss.segBtn, mode === m && ss.segBtnOn]}>
              <Text style={[ss.segText, mode === m && { color: palette.blue[50] }]}>
                {m === 'tap' ? `👆 ${t('game.tapMode')}` : `📷 ${t('game.cameraMode')}`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 스코어보드 — 3판 선승 */}
        <View style={[ss.board, shadows.card]}>
          <View style={ss.scoreCol}>
            <Text style={ss.scoreWho}>{t('game.you')}</Text>
            <Text style={ss.scoreNum}>{myScore}</Text>
          </View>
          <Text style={ss.vs}>{t('game.firstTo')}</Text>
          <View style={ss.scoreCol}>
            <Text style={ss.scoreWho}>AI Gganbu</Text>
            <Text style={ss.scoreNum}>{aiScore}</Text>
          </View>
        </View>

        {/* 라운드 결과 */}
        {round && !finished && (
          <View style={ss.roundBox}>
            <Text style={ss.roundHands}>
              {EMOJI[round.me]} vs {EMOJI[round.ai]}
            </Text>
            <Text
              style={[
                ss.roundResult,
                {
                  color:
                    round.result === 1
                      ? palette.success[50]
                      : round.result === -1
                        ? palette.error[50]
                        : palette.zinc[500],
                },
              ]}>
              {round.result === 1
                ? t('game.roundWin')
                : round.result === -1
                  ? t('game.roundLose')
                  : t('game.draw')}
            </Text>
          </View>
        )}
        {unknownHand && <Text style={ss.unknown}>{t('game.unknownHand')}</Text>}

        {/* 종료 화면 — 승리 시 게임존 입장(전통놀이 게임 자리) */}
        {finished ? (
          <View style={[ss.finish, shadows.card]}>
            <Text style={{ fontSize: 44 }}>{won ? '🏆' : '😅'}</Text>
            <Text style={ss.finishTitle}>{won ? t('game.win') : t('game.lose')}</Text>
            {won && earned != null && <Text style={ss.earned}>+{earned}P</Text>}
            {won && <Text style={ss.finishSub}>{t('game.zoneSoon')}</Text>}
            <Pressable onPress={reset} style={ss.retryBtn}>
              <Icon name="refresh" size={15} color="#fff" />
              <Text style={ss.retryText}>{t('game.retry')}</Text>
            </Pressable>
          </View>
        ) : mode === 'tap' ? (
          <View style={ss.handRow}>
            {HANDS.map((h) => (
              <Pressable key={h} onPress={() => playRound(h)} style={[ss.handBtn, shadows.card]}>
                <Text style={{ fontSize: 40 }}>{EMOJI[h]}</Text>
              </Pressable>
            ))}
          </View>
        ) : !perm?.granted ? (
          <Pressable onPress={() => requestPerm()} style={[ss.cameraBtn, shadows.blue]}>
            <Icon name="photo_camera" size={20} color="#fff" filled />
            <Text style={ss.cameraBtnText}>{t('game.grantCamera')}</Text>
          </Pressable>
        ) : (
          <View style={ss.camWrap}>
            {/* 셀피 라이브 프리뷰 — 실제 마주보고 내는 느낌 (front 고정) */}
            <CameraView ref={camRef} facing="front" style={ss.camView} />
            {/* AR 오버레이 — 상단 AI 손(흔들기→공개), 중앙 카운트다운, 하단 손 가이드 */}
            <View style={ss.camOverlay} pointerEvents="box-none">
              <View style={ss.aiHandBox}>
                <Text style={ss.aiHandLabel}>AI Gganbu</Text>
                <Text style={ss.aiHandEmoji}>
                  {camPhase === 'count' ? aiShake : round ? EMOJI[round.ai] : '🤖'}
                </Text>
              </View>
              {camPhase === 'count' && <Text style={ss.countText}>{count}</Text>}
              {camPhase === 'reading' && (
                <View style={ss.readingBox}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
              <View style={ss.handGuide}>
                <Text style={ss.handGuideText}>✊ ✋ ✌️</Text>
              </View>
              {camPhase === 'idle' && (
                <Pressable onPress={startDuel} style={[ss.duelBtn, shadows.blue]}>
                  <Text style={ss.duelBtnText}>{t('game.showHand')}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  segWrap: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: palette.zinc[100],
    borderRadius: 999,
    padding: 4,
  },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999 },
  segBtnOn: { backgroundColor: '#fff' },
  segText: { fontSize: 13, fontWeight: '800', color: palette.zinc[500] },
  board: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 18,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  scoreCol: { alignItems: 'center', gap: 4, minWidth: 90 },
  scoreWho: { fontSize: 12, fontWeight: '700', color: palette.zinc[500] },
  scoreNum: { fontSize: 34, fontWeight: '800', color: palette.zinc[900] },
  vs: { fontSize: 11, fontWeight: '700', color: palette.zinc[400] },
  roundBox: { alignItems: 'center', gap: 4 },
  roundHands: { fontSize: 34 },
  roundResult: { fontSize: 15, fontWeight: '800' },
  unknown: { textAlign: 'center', fontSize: 12.5, color: palette.coral[50], fontWeight: '700' },
  handRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  handBtn: {
    width: 92,
    height: 92,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.blue[50],
    borderRadius: 999,
    paddingVertical: 14,
  },
  cameraBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  camWrap: { borderRadius: 24, overflow: 'hidden', height: 430, backgroundColor: '#000' },
  camView: { flex: 1 },
  camOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center' },
  aiHandBox: {
    marginTop: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,.45)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  aiHandLabel: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  aiHandEmoji: { fontSize: 44, marginTop: 2 },
  countText: {
    marginTop: 40,
    fontSize: 84,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,.6)',
    textShadowRadius: 12,
  },
  readingBox: { marginTop: 70 },
  handGuide: {
    position: 'absolute',
    bottom: 78,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,.75)',
    borderRadius: 999,
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handGuideText: { fontSize: 22, opacity: 0.85 },
  duelBtn: {
    position: 'absolute',
    bottom: 14,
    backgroundColor: palette.blue[50],
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 26,
  },
  duelBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  finish: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  finishTitle: { fontSize: 19, fontWeight: '800', color: palette.zinc[900] },
  earned: { fontSize: 16, fontWeight: '800', color: palette.amber[50] },
  finishSub: { fontSize: 12.5, color: palette.zinc[500], textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.blue[50],
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 6,
  },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
})
