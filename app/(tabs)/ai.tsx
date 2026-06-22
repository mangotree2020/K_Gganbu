import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Keyboard,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useIsFocused } from 'expo-router'

import { Icon } from '@/components/brand'
import { FallbackBadge } from '@/components/FallbackBadge'
import { askGganbu } from '@/features/gganbu/services'
import { startLiveTranslate, type LiveSession } from '@/features/translate/geminiLive'
import { startMic, type MicHandle } from '@/features/translate/voiceAudio'
import { useRequireAccount } from '@/features/auth/loginPrompt'
import { useLocaleStore, useT } from '@/lib/i18n'
import { palette } from '@/theme/tokens'

type Schedule = { time: string; place: string; icon: string }
type ListItem = { name: string; note: string }
type Msg = {
  role: 'bot' | 'user'
  text: string
  quick?: string[]
  schedule?: Schedule[]
  list?: ListItem[]
  fallback?: boolean // 실 AI 대신 mock 응답일 때 배지 표시
}

const REPLIES: Record<string, Omit<Msg, 'role'>> = {
  'Make my day plan': {
    text: "You're in Haeundae, late morning. Try this half-day:",
    schedule: [
      { time: '11:00', place: 'Mipojeong (gukbap brunch)', icon: 'ramen_dining' },
      { time: '12:30', place: 'Blueline Sky Capsule', icon: 'tour' },
      { time: '14:00', place: 'Bada View Cafe', icon: 'local_cafe' },
      { time: '15:30', place: 'Gwangan Bridge stroll', icon: 'directions_walk' },
    ],
    quick: ['Add all to schedule', 'Find seafood instead', 'Make it cheaper'],
  },
  'Find foreigner-friendly food': {
    text: 'These spots have English menus AND foreigner reviews ≥4.5 ★:',
    list: [
      { name: 'Halmae Gukbap', note: 'EN menu · halal-option' },
      { name: 'Slow Calm', note: 'Vegetarian · QR menu in 5 lang' },
      { name: 'Ediya 24h', note: 'Cafe · accepts foreign cards' },
    ],
    quick: ['Show on map', 'Filter: halal', 'Filter: vegan'],
  },
  'Help me read a menu': {
    text: "Tap the camera button — I'll OCR & translate live, and flag allergens and spicy items.",
    quick: ['Open camera now', 'Set my allergies', 'How to ask for less spicy'],
  },
  "🆘 I'm stuck": {
    text: 'Tell me what is happening. I can call 1330 (tourist hotline, free, EN), translate for officials, or find your nearest embassy/hospital.',
    quick: ['Call 1330', 'Lost wallet', 'Got sick', 'Lost ride'],
  },
}

const INITIAL: Msg = {
  role: 'bot',
  text: "안녕! I'm Mate — your local Busan guide. I plan, translate, and rescue. Where shall we begin?",
  quick: [
    'Make my day plan',
    'Find foreigner-friendly food',
    'Help me read a menu',
    "🆘 I'm stuck",
  ],
}

// 마이크 권한 — Android RECORD_AUDIO. iOS는 react-native-audio-api가 자체 요청.
async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true
  try {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
    return r === PermissionsAndroid.RESULTS.GRANTED
  } catch {
    return false
  }
}

export default function AiMateScreen() {
  const t = useT()
  const requireAccount = useRequireAccount()
  const appLang = useLocaleStore((s) => s.lang)
  const [msgs, setMsgs] = useState<Msg[]>([INITIAL])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [listening, setListening] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  // 음성 질문(STT) — Gemini Live 전사 세션 + 마이크 캡처
  const sessionRef = useRef<LiveSession | null>(null)
  const micRef = useRef<MicHandle | null>(null)
  const sendRef = useRef<(text: string) => void>(() => {})

  const scrollEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)

  const send = async (text: string) => {
    if (!text.trim()) return
    const history: { role: 'user' | 'assistant'; text: string }[] = msgs.map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      text: m.text,
    }))
    setMsgs((m) => [...m, { role: 'user', text }])
    setInput('')
    setTyping(true)
    scrollEnd()

    // 알려진 퀵 리플라이는 카드형 응답(일정/리스트) 유지
    const canned = REPLIES[text]
    if (canned) {
      setTimeout(() => {
        setTyping(false)
        setMsgs((m) => [...m, { role: 'bot', ...canned }])
        scrollEnd()
      }, 600)
      return
    }

    // 그 외 자유 입력 → 실 AI 깐부(Claude+RAG) 호출, 실패 시 mock 폴백
    const { reply, provider } = await askGganbu([...history, { role: 'user', text }], {
      language: 'en',
      location: 'Haeundae, Busan',
    })
    setTyping(false)
    setMsgs((m) => [...m, { role: 'bot', text: reply, fallback: provider === 'mock' }])
    scrollEnd()
  }
  // 최신 send를 ref로 노출 — 음성 전사 콜백이 항상 최신 대화 이력으로 질문하도록
  useEffect(() => {
    sendRef.current = send
  })

  // 음성 듣기 중지 — 마이크/세션 정리
  const stopListening = () => {
    micRef.current?.stop()
    micRef.current = null
    sessionRef.current?.close()
    sessionRef.current = null
    setListening(false)
  }

  // 음성 듣기 시작 — 발화를 전사해 입력창에 채우고, 한 문장이 끝나면 자동 질문(끌 때까지 반복).
  // silent=true(화면 진입 자동 시작)면 권한/오류 알림을 띄우지 않는다.
  const startListening = async (silent = false) => {
    if (listening || sessionRef.current) return
    if (!(await ensureMicPermission())) {
      if (!silent) Alert.alert(t('ai.micDeniedTitle'), t('ai.micDenied'))
      return
    }
    const session = await startLiveTranslate(
      { appLang, mode: 'transcribe' },
      {
        onStatus: (s) => {
          if (s === 'error' || s === 'closed') stopListening()
        },
        onTurn: (turn) => {
          const text = turn.original.trim()
          if (!turn.final) {
            // 진행 중 — 입력창에 실시간 표시
            if (text) setInput(text)
            return
          }
          // 한 발화 종료 → 질문 전송 후 계속 듣기(마이크 끌 때까지)
          if (text) {
            sendRef.current(text)
            setInput('')
          }
        },
      },
    )
    if (!session) {
      if (!silent) Alert.alert(t('ai.micUnavailableTitle'), t('ai.micUnavailable'))
      return
    }
    sessionRef.current = session
    micRef.current = startMic((pcm) => sessionRef.current?.sendAudio(pcm))
    setListening(true)
  }

  // 마이크 아이콘 터치 — 켜져 있으면 Off, 꺼져 있으면 다시 On
  const toggleMic = () => {
    if (listening) stopListening()
    else startListening(false)
  }

  // 화면 진입 시 기본 On(바로 음성 지원), 이탈 시 Off(마이크 해제)
  const isFocused = useIsFocused()
  useEffect(() => {
    // 다음 틱으로 미뤄 실행(이펙트 내 동기 setState로 인한 연쇄 렌더 방지)
    const id = setTimeout(() => {
      if (isFocused) startListening(true)
      else stopListening()
    }, 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused])

  // 키보드 표시 시 채팅을 최신으로 스크롤(키보드에 가린 최근 메시지 노출)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => scrollEnd())
    return () => show.remove()
  }, [])

  // 언마운트 시 마이크/세션 정리(리소스 누수 방지)
  useEffect(() => {
    return () => {
      micRef.current?.stop()
      sessionRef.current?.close()
    }
  }, [])

  return (
    <View style={ss.container}>
      {/* 헤더 */}
      <View style={ss.header}>
        <SafeAreaView edges={['top']}>
          <View style={ss.headerRow}>
            <LinearGradient
              colors={['#38BDF8', '#0EA5E9', '#0D9488']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={ss.avatar}>
              <Icon name="auto_awesome" size={22} color="#fff" filled />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={ss.headerTitle}>AI Gganbu</Text>
              <View style={ss.statusRow}>
                <Icon name="circle" size={6} color={palette.success[50]} filled />
                <Text style={ss.statusText}>{t('ai.online')} · Claude Sonnet 4</Text>
              </View>
            </View>
            <Pressable
              onPress={() => requireAccount('auth.gateAi', () => {})}
              style={({ pressed }) => [ss.historyBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Icon name="history" size={18} color={palette.zinc[900]} />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>

      {/* 질문 입력 바 — 상단 배치(키보드가 가리지 않아 입력 텍스트가 항상 보임) */}
      <View style={ss.inputBar}>
        <Pressable
          onPress={toggleMic}
          style={[ss.micBtn, listening && ss.micBtnOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: listening }}>
          <Icon
            name="mic"
            size={18}
            color={listening ? '#fff' : palette.zinc[900]}
            filled={listening}
          />
        </Pressable>
        <View style={ss.inputWrap}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            placeholder={listening ? t('ai.listening') : t('ai.placeholder')}
            placeholderTextColor={palette.zinc[400]}
            style={ss.input}
            returnKeyType="send"
          />
        </View>
        <Pressable
          onPress={() => send(input)}
          style={[
            ss.sendBtn,
            { backgroundColor: input.trim() ? palette.blue[50] : palette.zinc[200] },
          ]}>
          <Icon name="arrow_upward" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* 듣는 중 안내 */}
      {listening && (
        <View style={ss.listeningBar}>
          <Icon name="mic" size={13} color={palette.coral[50]} filled />
          <Text style={ss.listeningText}>{t('ai.listening')}</Text>
        </View>
      )}

      {/* 채팅 영역 — 입력 바 아래를 채움 */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, gap: 10 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <View key={i} style={ss.userBubble}>
              <Text style={ss.userText}>{m.text}</Text>
            </View>
          ) : (
            <View key={i} style={ss.botCol}>
              <View style={ss.botBubble}>
                <Text style={ss.botText}>{m.text}</Text>
              </View>
              {m.fallback && <FallbackBadge label="Offline reply" style={{ marginTop: 6 }} />}
              {m.schedule && (
                <View style={ss.attachCard}>
                  {m.schedule.map((s, j) => (
                    <View key={j} style={ss.schedRow}>
                      <View style={ss.schedIcon}>
                        <Icon name={s.icon} size={16} color={palette.blue[30]} filled />
                      </View>
                      <Text style={ss.schedTime}>{s.time}</Text>
                      <Text style={ss.schedPlace}>{s.place}</Text>
                    </View>
                  ))}
                </View>
              )}
              {m.list && (
                <View style={ss.attachCard}>
                  {m.list.map((it) => (
                    <View key={it.name} style={ss.listRow}>
                      <Text style={ss.listName}>{it.name}</Text>
                      <Text style={ss.listNote}>{it.note}</Text>
                    </View>
                  ))}
                </View>
              )}
              {m.quick && (
                <View style={ss.quickWrap}>
                  {m.quick.map((q) => (
                    <Pressable key={q} onPress={() => send(q)} style={ss.quickChip}>
                      <Text style={ss.quickText}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ),
        )}
        {typing && (
          <View style={[ss.botBubble, ss.typingBubble]}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={ss.typingDot} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: palette.zinc[200],
    paddingHorizontal: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusText: { fontSize: 11, color: palette.zinc[500] },
  historyBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },

  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: palette.blue[50],
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderBottomRightRadius: 6,
  },
  userText: { color: '#fff', fontSize: 13, lineHeight: 19 },
  botCol: { alignSelf: 'flex-start', maxWidth: '94%', gap: 6 },
  botBubble: {
    backgroundColor: '#fff',
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  botText: { color: palette.zinc[900], fontSize: 13, lineHeight: 19 },
  attachCard: {
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  schedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  schedIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: palette.blue[90],
    alignItems: 'center',
    justifyContent: 'center',
  },
  schedTime: { width: 44, fontSize: 11, fontWeight: '700', color: palette.blue[30] },
  schedPlace: { flex: 1, fontSize: 12, color: palette.zinc[900], fontWeight: '500' },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  listName: { fontSize: 12.5, fontWeight: '700', color: palette.zinc[900] },
  listNote: { fontSize: 10, color: palette.zinc[500] },
  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickChip: {
    borderWidth: 0.5,
    borderColor: palette.blue[80],
    backgroundColor: palette.blue[95],
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  quickText: { color: palette.blue[30], fontSize: 11.5, fontWeight: '600' },
  typingBubble: { flexDirection: 'row', gap: 4, alignSelf: 'flex-start' },
  typingDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: palette.zinc[400] },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: palette.zinc[200],
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnOn: { backgroundColor: palette.coral[50] },
  listeningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: '#FFF1F2',
  },
  listeningText: { fontSize: 12, fontWeight: '700', color: palette.coral[50] },
  inputWrap: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  input: { fontSize: 13, color: palette.zinc[900], padding: 0 },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
