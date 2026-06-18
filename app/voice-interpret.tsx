// 음성 통역 화면 (PLANNING §25 B안) — 기기 ↔ Gemini Live 직결 멀티 화자 자동 통역.
// 길거리에서 여러 명이 각자 언어로 번갈아 대화하는 상황 대응. 목표 = 앱 설정 언어.
// 발화 언어를 스크립트로 감지해 국기·언어 칩 + 화자(언어)별 색상으로 구분.
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
import { APP_LANGS, useLocaleStore, useT, type AppLang } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'unavailable'
// lang: 감지된 발화 언어 코드. 화자(언어)별 색상·정렬·칩에 사용.
type Turn = { id: number; original: string; translation: string; lang: string }

// 발화 언어 감지(스크립트 기반) — 가나>한글>한자>라틴 우선순위.
// 일본어는 가나+한자가 섞이므로 가나를 먼저 확인(한자만이면 중국어).
// 한글·라틴 혼용 시 더 많은 쪽으로 판정(ASR이 영어를 한글 음차로 섞는 경우 보정).
const detectLang = (s: string): string => {
  if (/[぀-ヿ]/.test(s)) return 'ja' // 히라가나·가타카나
  const han = (s.match(/[가-힣]/g) || []).length
  const lat = (s.match(/[a-zA-Z]/g) || []).length
  if (han && lat) return lat >= han * 2 ? 'en' : 'ko' // 라틴이 한글의 2배↑면 영어
  if (han) return 'ko'
  if (/[一-鿿]/.test(s)) return 'zh-CN' // 한자만(가나 없음) → 중국어
  if (lat) return 'en'
  return '' // 미상
}

// 언어별 색상 톤 — 화자 구분용. accent: 칩·보더·내 말풍선 채움, tint: 상대 말풍선 배경
const LANG_TONE: Record<string, { accent: string; tint: string }> = {
  ko: { accent: palette.teal[40], tint: palette.teal[95] },
  ja: { accent: palette.coral[40], tint: palette.coral[95] },
  en: { accent: palette.blue[40], tint: palette.blue[95] },
  'zh-CN': { accent: palette.amber[50], tint: palette.amber[90] },
  'zh-TW': { accent: palette.amber[50], tint: palette.amber[90] },
}
const toneOf = (lang: string) =>
  LANG_TONE[lang] ?? { accent: palette.zinc[700], tint: palette.zinc[100] }
const langMeta = (code: string) =>
  APP_LANGS.find((l) => l.code === code) ?? { flag: '🌐', label: code || '?' }

// 대화 말풍선 — 화자(언어)별 색상·좌우 정렬. 언어 칩 + 원문 + 구분선 + 통역.
// isMe: 앱 사용자(앱 언어) 발화 → 우측·진한 톤. 상대 → 좌측·언어별 연한 톤.
function Bubble({
  original,
  translation,
  lang,
  isMe,
  dim,
}: {
  original: string
  translation: string
  lang: string
  isMe: boolean
  dim?: boolean
}) {
  const tone = toneOf(lang)
  const meta = langMeta(lang)
  const showDivider = !!original && !!translation
  return (
    <View style={[ss.turnRow, { justifyContent: isMe ? 'flex-end' : 'flex-start' }]}>
      <View
        style={[
          ss.card,
          isMe
            ? { backgroundColor: tone.accent, borderBottomRightRadius: 7 }
            : {
                backgroundColor: tone.tint,
                borderWidth: 1,
                borderColor: tone.accent,
                borderBottomLeftRadius: 7,
              },
          shadows.card,
          dim && { opacity: 0.55 },
        ]}>
        <View style={ss.speakerChip}>
          <Text style={ss.flag}>{meta.flag}</Text>
          <Text style={[ss.langLabel, { color: isMe ? 'rgba(255,255,255,.9)' : tone.accent }]}>
            {meta.label}
          </Text>
        </View>
        {!!original && (
          <Text
            style={[ss.original, { color: isMe ? 'rgba(255,255,255,.72)' : palette.zinc[500] }]}>
            {original}
          </Text>
        )}
        {showDivider && (
          <View
            style={[ss.divider, { backgroundColor: isMe ? 'rgba(255,255,255,.28)' : tone.accent }]}
          />
        )}
        {!!translation && (
          <Text style={[ss.translation, { color: isMe ? '#fff' : palette.zinc[900] }]}>
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
  const appLang: AppLang = useLocaleStore((s) => s.lang)
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
        { appLang },
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
                const orig = turn.original.trim()
                setTurns((prev) =>
                  [
                    ...prev,
                    {
                      id: idRef.current,
                      original: orig,
                      translation: turn.translation.trim(),
                      lang: detectLang(orig),
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
                  {turns.map((tn) => (
                    <Bubble
                      key={tn.id}
                      original={tn.original}
                      translation={tn.translation}
                      lang={tn.lang}
                      isMe={tn.lang === appLang}
                    />
                  ))}
                  {!!current &&
                    (current.original || current.translation) &&
                    (() => {
                      const cl = detectLang(current.original)
                      return (
                        <Bubble
                          original={current.original}
                          translation={current.translation}
                          lang={cl}
                          isMe={cl === appLang}
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
  speakerChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  flag: { fontSize: 13 },
  langLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  original: { fontSize: 12.5, lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 7, marginHorizontal: -2 },
  translation: { fontSize: 15.5, fontWeight: '700', lineHeight: 22, letterSpacing: -0.1 },

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
