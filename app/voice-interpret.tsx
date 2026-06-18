// 음성 통역 화면 (PLANNING §25 B안) — 기기 ↔ Gemini Live 직결 스트리밍 통역.
// 마이크 16kHz PCM(react-native-audio-api) → Gemini Live(geminiLive.ts) → 번역 음성 24kHz + 자막.
// LiveKit/Agent 불필요. 키는 ephemeral 토큰(gemini-live-token)으로 보호. 미설정/오류 시 텍스트 폴백.
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { startLiveTranslate, type LiveSession } from '@/features/translate/geminiLive'
import {
  createPlayer,
  startMic,
  type MicHandle,
  type Player,
} from '@/features/translate/voiceAudio'
import { useT } from '@/lib/i18n'
import { palette } from '@/theme/tokens'

type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'unavailable'
type Line = { id: number; text: string; mine: boolean }

async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true
  try {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
    return r === PermissionsAndroid.RESULTS.GRANTED
  } catch {
    return false
  }
}

export default function VoiceInterpretScreen() {
  const t = useT()
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [active, setActive] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [interim, setInterim] = useState({ src: '', dst: '' })
  const scrollRef = useRef<ScrollView>(null)

  const sessionRef = useRef<LiveSession | null>(null)
  const micRef = useRef<MicHandle | null>(null)
  const playerRef = useRef<Player | null>(null)
  const idRef = useRef(0)
  const srcBuf = useRef('')
  const dstBuf = useRef('')

  // 세션·오디오 정리
  const teardown = () => {
    micRef.current?.stop()
    micRef.current = null
    sessionRef.current?.close()
    sessionRef.current = null
    playerRef.current?.close()
    playerRef.current = null
    srcBuf.current = ''
    dstBuf.current = ''
  }

  const commit = (text: string, mine: boolean) => {
    if (!text.trim()) return
    idRef.current += 1
    const line = { id: idRef.current, text: text.trim(), mine }
    setLines((prev) => [...prev, line].slice(-30))
  }

  const start = async () => {
    setStatus('connecting')
    setLines([])
    const ok = await ensureMicPermission()
    if (!ok) {
      setStatus('error')
      return
    }
    try {
      const session = await startLiveTranslate(
        { sourceLang: 'auto', targetLang: 'ko' },
        {
          onStatus: (s) => {
            if (s === 'open') {
              setStatus('connected')
              // 마이크 캡처 시작 → Gemini로 스트리밍
              playerRef.current = createPlayer(24000)
              micRef.current = startMic((pcm) => sessionRef.current?.sendAudio(pcm))
            } else if (s === 'error' || s === 'closed') {
              failToFallback()
            }
          },
          onTranscript: (text, o) => {
            // 버퍼는 콜백 내에서만 변이(렌더 중 ref 읽지 않음) → 표시는 state로 미러링
            const buf = o.source ? srcBuf : dstBuf
            buf.current += text
            if (o.final) {
              commit(buf.current, o.source)
              buf.current = ''
            }
            setInterim({ src: srcBuf.current, dst: dstBuf.current })
          },
          onAudio: (pcm24) => playerRef.current?.play(pcm24),
        },
      )
      if (!session) {
        setStatus('unavailable') // 키 미설정 → 폴백 안내
        return
      }
      sessionRef.current = session
      setActive(true)
    } catch {
      teardown()
      setStatus('error')
    }
  }

  const stop = () => {
    teardown()
    setActive(false)
    setLines([])
    setInterim({ src: '', dst: '' })
    setStatus('idle')
  }

  // 연결 실패/끊김 → 정리 후 텍스트 번역 폴백 안내
  const failToFallback = () => {
    teardown()
    setActive(false)
    setInterim({ src: '', dst: '' })
    setStatus('error')
  }

  useEffect(() => () => teardown(), [])

  const interimSrc = interim.src
  const interimDst = interim.dst
  const empty = lines.length === 0 && !interimSrc && !interimDst

  return (
    <View style={ss.container}>
      {/* 하단 edge 포함 — '종료' 버튼이 안드로이드 시스템 내비 버튼에 가리지 않도록 */}
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        {/* 헤더 */}
        <View style={ss.header}>
          <View style={ss.headerIcon}>
            <Icon name="mic" size={20} color={palette.teal[40]} filled />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ss.title}>{t('voice.title')}</Text>
            <Text style={ss.sub}>{t('voice.headerSub')}</Text>
          </View>
          <Pressable onPress={() => router.back()} style={ss.close}>
            <Icon name="close" size={18} color={palette.zinc[700]} />
          </Pressable>
        </View>

        {active ? (
          <View style={ss.body}>
            <View style={ss.statusPill}>
              <Icon
                name="circle"
                size={8}
                color={status === 'connected' ? palette.success[50] : palette.amber[50]}
                filled
              />
              <Text style={ss.statusText}>
                {status === 'connected' ? t('voice.listening') : t('voice.connecting')}
              </Text>
            </View>

            <ScrollView
              ref={scrollRef}
              style={{ flex: 1, marginTop: 12 }}
              contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
              {empty ? (
                // 통역 출력이 아직 없을 때 — 안내 + 항상 보이는 텍스트 번역 탈출구
                <View style={{ alignItems: 'center', marginTop: 40, gap: 16 }}>
                  <Text style={ss.hint}>{t('voice.hint')}</Text>
                  <Pressable onPress={() => router.replace('/translate')} style={ss.toTextBtn}>
                    <Icon name="translate" size={15} color={palette.teal[40]} filled />
                    <Text style={ss.toTextText}>{t('voice.toText')}</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  {lines.map((l) => (
                    <View key={l.id} style={[ss.bubble, l.mine ? ss.mine : ss.theirs]}>
                      <Text style={[ss.bubbleText, l.mine && { color: '#fff' }]}>{l.text}</Text>
                    </View>
                  ))}
                  {!!interimSrc && (
                    <View style={[ss.bubble, ss.mine, { opacity: 0.6 }]}>
                      <Text style={[ss.bubbleText, { color: '#fff' }]}>{interimSrc}</Text>
                    </View>
                  )}
                  {!!interimDst && (
                    <View style={[ss.bubble, ss.theirs, { opacity: 0.6 }]}>
                      <Text style={ss.bubbleText}>{interimDst}</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <Pressable onPress={stop} style={ss.stopBtn}>
              <Icon name="close" size={18} color="#fff" />
              <Text style={ss.stopText}>{t('voice.end')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={ss.center}>
            <View style={ss.bigMic}>
              <Icon name="mic" size={44} color={palette.teal[40]} filled />
            </View>
            {status === 'unavailable' ? (
              <>
                <Text style={ss.bigTitle}>{t('voice.unavailableTitle')}</Text>
                <Text style={ss.bigSub}>{t('voice.unavailableSub')}</Text>
                <Pressable onPress={() => router.replace('/translate')} style={ss.altBtn}>
                  <Icon name="translate" size={16} color="#fff" filled />
                  <Text style={ss.altText}>{t('voice.toText')}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={ss.bigTitle}>{t('voice.realtimeTitle')}</Text>
                <Text style={ss.bigSub}>{t('voice.realtimeSub')}</Text>
                <Pressable
                  onPress={start}
                  disabled={status === 'connecting'}
                  style={[ss.startBtn, { opacity: status === 'connecting' ? 0.6 : 1 }]}>
                  <Icon name="mic" size={18} color="#fff" filled />
                  <Text style={ss.startText}>
                    {status === 'connecting' ? t('voice.connecting') : t('voice.start')}
                  </Text>
                </Pressable>
                {status === 'error' && (
                  <>
                    <Text style={ss.err}>{t('voice.error')}</Text>
                    <Pressable onPress={() => router.replace('/translate')} style={ss.altBtn}>
                      <Icon name="translate" size={16} color="#fff" filled />
                      <Text style={ss.altText}>{t('voice.toText')}</Text>
                    </Pressable>
                  </>
                )}
              </>
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
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
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.teal[95],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, color: palette.zinc[900] },
  sub: { fontSize: 12, color: palette.zinc[500], marginTop: 1 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: palette.zinc[100],
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: { fontSize: 12, fontWeight: '600', color: palette.zinc[700] },
  hint: { fontSize: 13, color: palette.zinc[400], textAlign: 'center' },
  toTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: palette.teal[80],
    backgroundColor: palette.teal[95],
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  toTextText: { fontSize: 13, fontWeight: '700', color: palette.teal[40] },
  bubble: { maxWidth: '88%', borderRadius: 16, paddingVertical: 9, paddingHorizontal: 13 },
  mine: { alignSelf: 'flex-end', backgroundColor: palette.blue[50], borderBottomRightRadius: 6 },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: palette.teal[95],
    borderWidth: 0.5,
    borderColor: palette.teal[80],
    borderBottomLeftRadius: 6,
  },
  bubbleText: { fontSize: 14, color: palette.zinc[900], lineHeight: 20 },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.error[50],
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  stopText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  bigMic: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: palette.teal[95],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bigTitle: { fontSize: 20, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.4 },
  bigSub: { fontSize: 13.5, color: palette.zinc[500], textAlign: 'center', lineHeight: 20 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: palette.teal[40],
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 28,
  },
  startText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  altBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: palette.teal[40],
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 24,
  },
  altText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  err: { fontSize: 12, color: palette.error[50], textAlign: 'center', marginTop: 8 },
})
