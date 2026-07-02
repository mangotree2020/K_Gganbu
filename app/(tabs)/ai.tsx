import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Keyboard,
  Modal,
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
import { track } from '@/features/analytics/service'
import { askGganbuStream } from '@/features/gganbu/services'
import {
  loadChatSessions,
  saveChatSession,
  saveChatSessionRemote,
  flushChatRemote,
  deleteChatSession,
  clearChatSessions,
  type ChatSession,
} from '@/features/gganbu/chatHistory'
import { DIALECTS, dialectFromCoords, type Dialect } from '@/features/gganbu/dialect'
import { useMapPois } from '@/features/map/queries'
import { loadSessions } from '@/features/translate/history'
import { startLiveTranslate, type LiveSession } from '@/features/translate/geminiLive'
import { startMic, type MicHandle } from '@/features/translate/voiceAudio'
import { useWeather } from '@/features/weather/queries'
import { useCityLabel } from '@/features/weather/useCityLabel'
import { useCurrentLocation } from '@/hooks/useCurrentLocation'
import { speakMessage, stopSpeak } from '@/lib/speak'
import { toSpeakable } from '@/lib/speakable'
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
  const appLang = useLocaleStore((s) => s.lang)
  const [msgs, setMsgs] = useState<Msg[]>([INITIAL])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [listening, setListening] = useState(false)
  // 대화 이력 — 현재 세션 id + 이력 목록 모달
  const sessionIdRef = useRef(0)
  const [histOpen, setHistOpen] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  // 사투리 모드 — 한국어일 때 기본 활성화(현지 로컬 친구 느낌). 한국어 전용.
  const koOnly = appLang === 'ko'
  const [satoori, setSatoori] = useState(koOnly)
  const [dialect, setDialect] = useState<Dialect>(DIALECTS.standard)
  const { coords } = useCurrentLocation()
  // 정확한 답변용 실시간 컨텍스트 소스 — 날씨/현재 도시/주변 장소
  const { data: weather } = useWeather(coords)
  const city = useCityLabel(coords, appLang)
  const { data: nearbyData } = useMapPois(appLang, 8)
  const scrollRef = useRef<ScrollView>(null)
  // 음성 질문(STT) — Gemini Live 전사 세션 + 마이크 캡처
  const sessionRef = useRef<LiveSession | null>(null)
  const micRef = useRef<MicHandle | null>(null)
  const sendRef = useRef<(text: string, mode?: 'text' | 'quick' | 'voice') => void>(() => {})
  // TTS 재생 중 플래그 — 마이크가 AI 음성을 다시 전사(에코 루프)하지 않도록 게이팅
  const speakingRef = useRef(false)

  const scrollEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)

  // 정확한 답변용 컨텍스트 문자열 — 날씨/현재 도시/주변 장소 + 사용자가 통역한 최근 내용
  const buildContext = () => {
    const parts: string[] = []
    parts.push(`Weather now: about ${weather?.tempC ?? 19}°C, ${weather?.condition ?? 'clear'}.`)
    if (city) parts.push(`Traveler is near: ${city}.`)
    const names = (nearbyData?.pois ?? [])
      .map((p) => p.name)
      .filter(Boolean)
      .slice(0, 6)
    if (names.length) parts.push(`Nearby real places: ${names.join(', ')}.`)
    const recent = loadSessions()
      .flatMap((s) => s.turns.map((tn) => tn.original))
      .filter(Boolean)
      .slice(-5)
    if (recent.length) parts.push(`Recently the traveler said/translated: ${recent.join(' | ')}.`)
    return parts.join(' ')
  }

  // AI 답변을 음성으로 읽어줌 — 마크다운/이모지/불릿 제거 후 "문장만" 자연스럽게 발화.
  // 사투리 모드면 한국어로. 음성 입력 중이면 재생 동안 마이크 차단(에코 루프 방지).
  const speakReply = (text: string) => {
    const spoken = toSpeakable(text)
    if (!spoken) return
    // 실제 텍스트 스크립트로 발화 언어 판정(사투리 답변은 한글 → ko)
    const lang = /[가-힣]/.test(spoken)
      ? 'ko'
      : /[ぁ-んァ-ン]/.test(spoken)
        ? 'ja'
        : /[一-鿿]/.test(spoken)
          ? appLang === 'zh-TW'
            ? 'zh-TW'
            : 'zh-CN'
          : 'en'
    speakingRef.current = true
    speakMessage(spoken, lang, () => {
      // 스피커 잔향이 마이크에 남는 시간 여유 후 입력 재개
      setTimeout(() => {
        speakingRef.current = false
      }, 300)
    })
  }

  const send = async (text: string, mode: 'text' | 'quick' | 'voice' = 'text') => {
    if (!text.trim()) return
    // 전환 계측(REQ-AI-3): 질문 발생 — 북극성 지표(AI→쿠폰 전환) 퍼널의 시작점
    track('ai_ask', { mode, length: text.trim().length })
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
      track('ai_reply', { provider: 'mock', has_card: !!(canned.schedule || canned.list) })
      setTimeout(() => {
        setTyping(false)
        setMsgs((m) => [...m, { role: 'bot', ...canned }])
        speakReply(canned.text)
        scrollEnd()
      }, 600)
      return
    }

    // 그 외 자유 입력 → 실 AI 깐부(Claude) 스트리밍. 토큰이 도착하는 즉시 말풍선에 흘려준다.
    // 사투리 ON이면 한국어 지역 방언으로, 아니면 앱 언어로 답변 → TTS도 같은 언어로.
    let started = false
    // 스트리밍 말풍선(마지막 봇 메시지)의 텍스트를 갱신
    const updateLast = (full: string, extra: Partial<Msg> = {}) =>
      setMsgs((m) => {
        if (!m.length) return m
        const copy = [...m]
        copy[copy.length - 1] = { ...copy[copy.length - 1], text: full, ...extra }
        return copy
      })
    const { reply, provider } = await askGganbuStream(
      [...history, { role: 'user', text }],
      {
        language: satoori ? 'ko' : appLang,
        location: city || 'Haeundae, Busan',
        dialect: satoori ? dialect.instruction : undefined,
        context: buildContext(),
      },
      (full) => {
        // 첫 토큰 도착 → 타이핑 표시를 끄고 봇 말풍선 생성, 이후 누적 갱신
        if (!started) {
          started = true
          setTyping(false)
          setMsgs((m) => [...m, { role: 'bot', text: full }])
        } else {
          updateLast(full)
        }
        scrollEnd()
      },
    )
    setTyping(false)
    track('ai_reply', { provider, has_card: false })
    // 스트림이 한 글자도 못 받았으면(에러/mock) 새 말풍선으로, 받았으면 최종 확정
    if (!started) {
      setMsgs((m) => [...m, { role: 'bot', text: reply, fallback: provider === 'mock' }])
    } else {
      updateLast(reply, { fallback: provider === 'mock' })
    }
    speakReply(reply)
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
          if (s === 'error' || s === 'closed' || s === 'limit') stopListening()
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
            sendRef.current(text, 'voice')
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
    // TTS 재생 중(speakingRef)에는 오디오 전송 차단 — AI 음성의 에코 재전사 방지
    micRef.current = startMic((pcm) => {
      if (speakingRef.current) return
      sessionRef.current?.sendAudio(pcm)
    })
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
      else {
        stopListening()
        stopSpeak()
      }
    }, 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused])

  // GPS 좌표 → 지역 사투리 자동 감지(버튼 표시·사투리 답변용)
  useEffect(() => {
    let alive = true
    dialectFromCoords(coords).then((d) => {
      if (alive) setDialect(d)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords.latitude, coords.longitude])

  // 사투리는 한국어 전용 — 앱 언어가 한국어가 아니면 자동 해제
  useEffect(() => {
    if (koOnly) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSatoori(false)
  }, [koOnly])

  // 키보드 표시 시 채팅을 최신으로 스크롤(키보드에 가린 최근 메시지 노출)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => scrollEnd())
    return () => show.remove()
  }, [])

  // 대화가 바뀔 때마다 현재 세션을 이력에 저장(upsert) — 사용자 발화가 있을 때만
  useEffect(() => {
    if (msgs.some((m) => m.role === 'user')) {
      sessionIdRef.current = saveChatSession(
        msgs.map((m) => ({ role: m.role, text: m.text })),
        sessionIdRef.current,
      )
    }
  }, [msgs])

  // 언마운트 시 마이크/세션/TTS 정리(리소스 누수·잔여 발화 방지)
  useEffect(() => {
    return () => {
      micRef.current?.stop()
      sessionRef.current?.close()
      stopSpeak()
    }
  }, [])

  // 진입 시 미전송 대화 세션 재시도(서버 업로드)
  useEffect(() => {
    flushChatRemote()
  }, [])

  // 이력 열기/복원/새 대화/삭제
  const openHistory = () => {
    setSessions(loadChatSessions())
    setHistOpen(true)
  }
  const restoreSession = (s: ChatSession) => {
    stopSpeak()
    setMsgs(s.messages.map((m) => ({ role: m.role, text: m.text })))
    sessionIdRef.current = s.id
    setHistOpen(false)
    scrollEnd()
  }
  const newChat = () => {
    stopSpeak()
    setMsgs([INITIAL])
    sessionIdRef.current = 0
    setInput('')
    setHistOpen(false)
  }
  // 헤더 X(닫기) — 현재 대화를 이력 저장(로컬 최종 + 서버) 후 새 대화로 초기화.
  const closeChat = () => {
    const hasUser = msgs.some((m) => m.role === 'user' && m.text.trim())
    if (hasUser) {
      const slim = msgs.filter((m) => m.text.trim()).map((m) => ({ role: m.role, text: m.text }))
      const sid = saveChatSession(slim, sessionIdRef.current) // 로컬 최종 저장(upsert)
      const title = msgs
        .find((m) => m.role === 'user' && m.text.trim())
        ?.text.trim()
        .slice(0, 40)
      saveChatSessionRemote({ id: sid, at: Date.now(), title: title ?? '', messages: slim }) // 서버(큐+재시도)
    }
    newChat()
  }
  const removeSession = (id: number) => {
    deleteChatSession(id)
    setSessions(loadChatSessions())
    if (sessionIdRef.current === id) sessionIdRef.current = 0
  }
  const clearAll = () => {
    clearChatSessions()
    setSessions([])
    sessionIdRef.current = 0
  }

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
            {/* 사투리 토글 — 한국어 전용(기본 ON). 외국어면 비활성 + 탭 시 음성 안내 */}
            <Pressable
              onPress={() => {
                if (!koOnly) {
                  // 언어 변경이 필요하다는 안내를 앱 언어로 말해줌
                  speakingRef.current = true
                  speakMessage(t('ai.dialectKoOnly'), appLang, () => {
                    setTimeout(() => {
                      speakingRef.current = false
                    }, 300)
                  })
                  return
                }
                setSatoori((v) => !v)
              }}
              style={[ss.satooriBtn, satoori && ss.satooriBtnOn, !koOnly && { opacity: 0.45 }]}
              accessibilityRole="button"
              accessibilityState={{ selected: satoori, disabled: !koOnly }}>
              <Icon
                name="megaphone"
                size={13}
                color={satoori ? '#fff' : palette.zinc[600]}
                filled={satoori}
              />
              <Text style={[ss.satooriText, { color: satoori ? '#fff' : palette.zinc[700] }]}>
                {satoori ? dialect.label : t('ai.dialect')}
              </Text>
            </Pressable>
            <Pressable
              onPress={openHistory}
              style={({ pressed }) => [ss.historyBtn, { opacity: pressed ? 0.7 : 1 }]}
              accessibilityRole="button">
              <Icon name="history" size={18} color={palette.zinc[900]} />
            </Pressable>
            {/* X(닫기) — 대화 이력 저장(로컬+서버) 후 새 대화 */}
            <Pressable
              onPress={closeChat}
              style={({ pressed }) => [ss.historyBtn, { opacity: pressed ? 0.7 : 1 }]}
              accessibilityRole="button">
              <Icon name="close" size={18} color={palette.zinc[900]} />
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
                    <Pressable key={q} onPress={() => send(q, 'quick')} style={ss.quickChip}>
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

      {/* 대화 이력 모달 — 지난 대화 목록(복원/삭제) + 새 대화 */}
      <Modal
        visible={histOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setHistOpen(false)}>
        <View style={ss.histBackdrop}>
          <View style={ss.histSheet}>
            <SafeAreaView edges={['bottom']}>
              <View style={ss.histHead}>
                <Text style={ss.histTitle}>{t('ai.history')}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={newChat} style={ss.histNewBtn}>
                    <Icon name="add" size={15} color="#fff" />
                    <Text style={ss.histNewText}>{t('ai.newChat')}</Text>
                  </Pressable>
                  <Pressable onPress={() => setHistOpen(false)} style={ss.histCloseBtn}>
                    <Icon name="close" size={18} color={palette.zinc[700]} />
                  </Pressable>
                </View>
              </View>
              {sessions.length === 0 ? (
                <Text style={ss.histEmpty}>{t('ai.historyEmpty')}</Text>
              ) : (
                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                  {sessions.map((s) => (
                    <Pressable key={s.id} onPress={() => restoreSession(s)} style={ss.histRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={ss.histRowTitle} numberOfLines={1}>
                          {s.title || '…'}
                        </Text>
                        <Text style={ss.histRowMeta}>
                          {new Date(s.at).toLocaleString()} · {s.messages.length}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => removeSession(s.id)}
                        hitSlop={10}
                        style={ss.histDelBtn}>
                        <Icon name="close" size={15} color={palette.zinc[400]} />
                      </Pressable>
                    </Pressable>
                  ))}
                  <Pressable onPress={clearAll} style={ss.histClearAll}>
                    <Text style={ss.histClearText}>{t('ai.clearHistory')}</Text>
                  </Pressable>
                </ScrollView>
              )}
            </SafeAreaView>
          </View>
        </View>
      </Modal>
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
  satooriBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    borderWidth: 1,
    borderColor: palette.zinc[200],
  },
  satooriBtnOn: { backgroundColor: palette.coral[50], borderColor: palette.coral[50] },
  satooriText: { fontSize: 11, fontWeight: '800', letterSpacing: -0.2 },

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
  // 대화 이력 모달
  histBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  histSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  histHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  histTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: palette.zinc[900] },
  histNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.blue[50],
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 32,
  },
  histNewText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  histCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  histEmpty: { fontSize: 13, color: palette.zinc[400], textAlign: 'center', paddingVertical: 32 },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.zinc[200],
  },
  histRowTitle: { fontSize: 14, fontWeight: '700', color: palette.zinc[900] },
  histRowMeta: { fontSize: 11, color: palette.zinc[400], marginTop: 2 },
  histDelBtn: { padding: 4 },
  histClearAll: { alignItems: 'center', paddingVertical: 16 },
  histClearText: { fontSize: 12, fontWeight: '700', color: palette.error[50] },
})
