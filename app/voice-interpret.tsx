// 음성 통역 화면 (PLANNING §25 B안) — 기기 ↔ Gemini Live 직결 양방향 자동 통역.
// 외국인 발화→한국어, 한국어 발화→외국인 언어. 대화형 말풍선(화자별 좌/우 정렬).
// 마이크 16kHz PCM(react-native-audio-api) → Gemini Live → 통역 음성 24kHz + 원문/통역 자막.
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
import { APP_LANGS, useLocaleStore, useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'unavailable'
// fromKorean: 한국어 발화(좌·청록) vs 외국인 발화(우·파랑)
type Turn = { id: number; original: string; translation: string; fromKorean: boolean }

const hasHangul = (s: string) => /[가-힣]/.test(s)
// 화자 판별 — 번역 방향 기준(ASR 원문보다 견고). 번역문이 한국어면 한국어 화자가
// 아닌 상대(외국어)가 말한 것 → false. 번역문이 외국어면 한국어 화자 → true.
// (원문 ASR은 외국어를 한글 음차로 받는 경우가 있어 번역 방향으로 판정)
const isKoreanSpeaker = (original: string, translation: string) =>
  translation ? !hasHangul(translation) : hasHangul(original)

// 대화 말풍선 — 화자별 좌/우 정렬. 언어 칩 + 원문 + 구분선 + 통역.
function Bubble({
  original,
  translation,
  fromKorean,
  flag,
  langLabel,
  dim,
}: {
  original: string
  translation: string
  fromKorean: boolean
  flag: string
  langLabel: string
  dim?: boolean
}) {
  const showDivider = !!original && !!translation
  return (
    <View style={[ss.turnRow, { justifyContent: fromKorean ? 'flex-start' : 'flex-end' }]}>
      <View
        style={[
          ss.card,
          fromKorean ? ss.cardKo : ss.cardForeign,
          shadows.card,
          dim && { opacity: 0.55 },
        ]}>
        <View style={ss.speakerChip}>
          <Text style={ss.flag}>{flag}</Text>
          <Text style={[ss.langLabel, fromKorean ? ss.langLabelKo : ss.langLabelForeign]}>
            {langLabel}
          </Text>
        </View>
        {!!original && (
          <Text style={[ss.original, fromKorean ? ss.originalKo : ss.originalForeign]}>
            {original}
          </Text>
        )}
        {showDivider && (
          <View style={[ss.divider, fromKorean ? ss.dividerKo : ss.dividerForeign]} />
        )}
        {!!translation && (
          <Text style={[ss.translation, fromKorean ? ss.translationKo : ss.translationForeign]}>
            {translation}
          </Text>
        )}
      </View>
    </View>
  )
}

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
  const lang = useLocaleStore((s) => s.lang)
  const foreignerLang = lang === 'ko' ? 'en' : lang
  // 감지된 언어 코드 → 칩 메타(국기 + 언어명)
  const langMeta = (code: string) =>
    APP_LANGS.find((l) => l.code === code) ?? { flag: '🌐', label: code }
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [active, setActive] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [current, setCurrent] = useState<{ original: string; translation: string } | null>(null)
  const scrollRef = useRef<ScrollView>(null)

  const sessionRef = useRef<LiveSession | null>(null)
  const micRef = useRef<MicHandle | null>(null)
  const playerRef = useRef<Player | null>(null)
  const idRef = useRef(0)

  const teardown = () => {
    micRef.current?.stop()
    micRef.current = null
    sessionRef.current?.close()
    sessionRef.current = null
    playerRef.current?.close()
    playerRef.current = null
  }

  const start = async () => {
    setStatus('connecting')
    setTurns([])
    setCurrent(null)
    if (!(await ensureMicPermission())) {
      setStatus('error')
      return
    }
    try {
      const session = await startLiveTranslate(
        { foreignerLang },
        {
          onStatus: (s) => {
            if (s === 'open') {
              setStatus('connected')
              playerRef.current = createPlayer(24000)
              micRef.current = startMic((pcm) => sessionRef.current?.sendAudio(pcm))
            } else if (s === 'error' || s === 'closed') {
              failToFallback()
            }
          },
          onTurn: (turn) => {
            if (turn.final) {
              setCurrent(null)
              if (turn.original.trim() || turn.translation.trim()) {
                idRef.current += 1
                setTurns((prev) =>
                  [
                    ...prev,
                    {
                      id: idRef.current,
                      original: turn.original.trim(),
                      translation: turn.translation.trim(),
                      fromKorean: isKoreanSpeaker(turn.original, turn.translation),
                    },
                  ].slice(-40),
                )
              }
            } else {
              setCurrent({ original: turn.original, translation: turn.translation })
            }
          },
          onAudio: (pcm24) => playerRef.current?.play(pcm24),
        },
      )
      if (!session) {
        setStatus('unavailable')
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
    setTurns([])
    setCurrent(null)
    setStatus('idle')
  }

  const failToFallback = () => {
    teardown()
    setActive(false)
    setCurrent(null)
    setStatus('error')
  }

  useEffect(() => () => teardown(), [])

  const empty = turns.length === 0 && !current?.original && !current?.translation

  return (
    <View style={ss.container}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
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
              contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
              {empty ? (
                <View style={{ alignItems: 'center', marginTop: 40, gap: 16 }}>
                  <Text style={ss.hint}>{t('voice.hint')}</Text>
                  <Pressable onPress={() => router.replace('/translate')} style={ss.toTextBtn}>
                    <Icon name="translate" size={15} color={palette.teal[40]} filled />
                    <Text style={ss.toTextText}>{t('voice.toText')}</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  {turns.map((tn) => {
                    // 화자 언어 = 정렬과 동일 신호(번역 방향). 한국어 화자→ko, 상대→앱 언어.
                    const m = langMeta(tn.fromKorean ? 'ko' : foreignerLang)
                    return (
                      <Bubble
                        key={tn.id}
                        original={tn.original}
                        translation={tn.translation}
                        fromKorean={tn.fromKorean}
                        flag={m.flag}
                        langLabel={m.label}
                      />
                    )
                  })}
                  {!!current &&
                    (current.original || current.translation) &&
                    (() => {
                      const fromKorean = isKoreanSpeaker(current.original, current.translation)
                      const m = langMeta(fromKorean ? 'ko' : foreignerLang)
                      return (
                        <Bubble
                          original={current.original}
                          translation={current.translation}
                          fromKorean={fromKorean}
                          flag={m.flag}
                          langLabel={m.label}
                          dim
                        />
                      )
                    })()}
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

  // 대화 말풍선
  turnRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  card: {
    maxWidth: '86%',
    minWidth: 140,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cardForeign: { backgroundColor: palette.blue[50], borderBottomRightRadius: 7 },
  cardKo: {
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: palette.teal[80],
    borderBottomLeftRadius: 7,
  },
  speakerChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  flag: { fontSize: 13 },
  langLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  langLabelForeign: { color: 'rgba(255,255,255,.85)' },
  langLabelKo: { color: palette.teal[40] },
  original: { fontSize: 12.5, lineHeight: 18 },
  originalForeign: { color: 'rgba(255,255,255,.72)' },
  originalKo: { color: palette.zinc[500] },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 7, marginHorizontal: -2 },
  dividerForeign: { backgroundColor: 'rgba(255,255,255,.28)' },
  dividerKo: { backgroundColor: palette.teal[80] },
  translation: { fontSize: 15.5, fontWeight: '700', lineHeight: 22, letterSpacing: -0.1 },
  translationForeign: { color: '#fff' },
  translationKo: { color: palette.zinc[900] },

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
