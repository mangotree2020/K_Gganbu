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
  Switch,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Slider from '@react-native-community/slider'

import { Icon } from '@/components/brand'
import { storage } from '@/lib/mmkv'
import { startLiveTranslate, type LiveSession } from '@/features/translate/geminiLive'
import { saveSession } from '@/features/translate/history'
import { resetSpeaker, setSpeaker } from '../modules/expo-speaker-route'
import {
  createPlayer,
  isHeadsetConnected,
  observeRouteChange,
  rms16,
  startMic,
  type MicHandle,
  type Player,
} from '@/features/translate/voiceAudio'
import { APP_LANGS, useLocaleStore, useT, type AppLang } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'unavailable'

// 세션이 비정상 종료되면 자동 재연결 시도(대화 유지). 초과 시 에러 화면.
// 일시적 끊김(터널·순간 약화)을 견디도록 5회 × 1.5초 ≈ 7.5초 동안 재시도.
const MAX_RECONNECT = 5
const RECONNECT_DELAY_MS = 1500

// 동시 발화 게이트 임계 — 통역 재생 중 이 RMS 이상의 입력만 통과(실제 발화 vs 에코 누설).
// 적용 범위: '이어폰 + 내 통역 스피커 출력' 구간 한정(누설이 제한적이라 동시 발화 허용 목적).
// 스피커 모드(이어폰 미사용)는 누설이 임계를 넘겨 되먹임을 일으키므로 게이트가 아닌
// 완전 half-duplex(재생 중 마이크 전체 차단)로 처리한다.
// 기기 실측 결과 스피커 누설 피크가 ~0.044라, 그 위인 0.05로 설정(누설 차단 + 발화 통과).
const SPEECH_RMS_GATE = 0.05
// lang: 감지된 발화 언어 코드. 화자(언어)별 색상·정렬·칩에 사용.
// hasAudio: 통역 음성 보유 여부(다시 듣기 버튼 표시용. PCM은 audioStoreRef에 보관).
type Turn = { id: number; original: string; translation: string; lang: string; hasAudio: boolean }

// 발화 언어 감지 — Gemini 감지 코드(normalizeLang)가 없을 때만 쓰는 스크립트 기반 폴백.
// 스크립트로 확실히 갈리는 언어만 처리한다. 라틴 세부 구분(en/id)·한자 번체 구분(zh-TW)은
// 스크립트만으로는 불확실하므로 폴백에서 시도하지 않고 Gemini 코드에 맡긴다(en/zh-CN로 근사).
const detectLang = (s: string): string => {
  if (/[぀-ヿ]/.test(s)) return 'ja' // 가나(일본어) — 한자보다 먼저
  if (/[฀-๿]/.test(s)) return 'th' // 태국 문자
  if (/[đơưăĐƠƯĂ]|[Ạ-ỿ]/.test(s)) return 'vi' // 베트남 전용 발음부호
  const han = (s.match(/[가-힣]/g) || []).length
  const lat = (s.match(/[a-zA-Z]/g) || []).length
  if (han && lat) return lat >= han * 2 ? 'en' : 'ko' // 라틴이 한글의 2배↑면 영어
  if (han) return 'ko'
  if (/[一-鿿]/.test(s)) return 'zh-CN' // 한자 → 중국어(번체 구분은 Gemini 코드로)
  if (lat) return 'en' // 라틴 → 영어(인니어 구분은 Gemini 코드로)
  return '' // 미상
}

// Gemini가 준 BCP-47 감지 코드(예: 'vi-VN','id-ID','cmn-Hant-TW','zh','en-US')를
// 앱 내부 코드(en/ko/ja/zh-CN/zh-TW/th/vi/id)로 정규화. 미지원 코드는 ''(폴백 유도).
const normalizeLang = (code?: string): string => {
  if (!code) return ''
  const c = code.toLowerCase()
  if (c.startsWith('ko')) return 'ko'
  if (c.startsWith('ja')) return 'ja'
  if (c.startsWith('th')) return 'th'
  if (c.startsWith('vi')) return 'vi'
  if (c.startsWith('id') || c.startsWith('in')) return 'id' // 인니어 구표기 'in'
  if (c.startsWith('en')) return 'en'
  // 중국어 계열(zh/cmn/yue) — 번체 신호(hant/tw/hk/mo)면 대만, 아니면 간체
  if (c.startsWith('zh') || c.startsWith('cmn') || c.startsWith('yue'))
    return /hant|tw|hk|mo/.test(c) ? 'zh-TW' : 'zh-CN'
  return ''
}

// 언어별 색상 톤 — 화자 구분용. accent: 칩·보더·내 말풍선 채움, tint: 상대 말풍선 배경
const LANG_TONE: Record<string, { accent: string; tint: string }> = {
  ko: { accent: palette.teal[40], tint: palette.teal[95] },
  ja: { accent: palette.coral[40], tint: palette.coral[95] },
  en: { accent: palette.blue[40], tint: palette.blue[95] },
  'zh-CN': { accent: palette.amber[50], tint: palette.amber[90] },
  'zh-TW': { accent: palette.rose[40], tint: palette.rose[95] }, // 간체(amber)와 구분
  th: { accent: palette.violet[40], tint: palette.violet[95] },
  vi: { accent: palette.success[50], tint: palette.success[90] },
  id: { accent: palette.indigo[40], tint: palette.indigo[95] },
}
const toneOf = (lang: string) =>
  LANG_TONE[lang] ?? { accent: palette.zinc[700], tint: palette.zinc[100] }
// 통역 화자는 UI 5개 언어(APP_LANGS) 외에도 감지됨(Gemini Live 70+ 언어).
// APP_LANGS에 없는 언어의 국기·라벨을 보강한다(미보강 시 detectLang 폴백으로 엉뚱한 국기 노출).
const EXTRA_LANG_META: Record<string, { flag: string; label: string }> = {
  th: { flag: '🇹🇭', label: 'ไทย' },
  vi: { flag: '🇻🇳', label: 'Tiếng Việt' },
  id: { flag: '🇮🇩', label: 'Bahasa' },
}
const langMeta = (code: string) =>
  APP_LANGS.find((l) => l.code === code) ??
  EXTRA_LANG_META[code] ?? { flag: '🌐', label: code || '?' }

// 대화 말풍선 — 화자(언어)별 색상·좌우 정렬. 언어 칩 + 원문 + 구분선 + 통역.
// isMe: 앱 사용자(앱 언어) 발화 → 우측·진한 톤. 상대 → 좌측·언어별 연한 톤.
// onReplay: 통역 음성 다시 듣기(있을 때만 스피커 버튼 표시).
function Bubble({
  original,
  translation,
  lang,
  isMe,
  dim,
  onReplay,
}: {
  original: string
  translation: string
  lang: string
  isMe: boolean
  dim?: boolean
  onReplay?: () => void
}) {
  const tone = toneOf(lang)
  const meta = langMeta(lang)
  const accentOnCard = isMe ? 'rgba(255,255,255,.9)' : tone.accent
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
        <View style={ss.chipRow}>
          <View style={ss.speakerChip}>
            <Text style={ss.flag}>{meta.flag}</Text>
            <Text style={[ss.langLabel, { color: accentOnCard }]}>{meta.label}</Text>
          </View>
          {!!onReplay && (
            <Pressable
              onPress={onReplay}
              hitSlop={10}
              style={[ss.replayBtn, { backgroundColor: isMe ? 'rgba(255,255,255,.18)' : '#fff' }]}>
              <Icon name="volume_up" size={14} color={accentOnCard} filled />
            </Pressable>
          )}
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

// 설정 토글 행 — 아이콘 + 라벨 + 스위치. accent로 ON 색상 지정.
function ToggleRow({
  icon,
  label,
  value,
  onToggle,
  accent = palette.teal[40],
}: {
  icon: string
  label: string
  value: boolean
  onToggle: () => void
  accent?: string
}) {
  return (
    <View style={ss.toggleRow}>
      <Pressable onPress={onToggle} hitSlop={6} style={ss.toggleLabelGroup}>
        <Icon name={icon} size={18} color={value ? accent : palette.zinc[400]} filled />
        <Text style={[ss.toggleLabel, !value && { color: palette.zinc[400] }]}>{label}</Text>
      </Pressable>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: `${accent}66`, false: palette.zinc[300] }}
        thumbColor={value ? accent : '#f4f4f5'}
      />
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
  const [current, setCurrent] = useState<{
    original: string
    translation: string
    lang: string
  } | null>(null)
  // 통역 음성 볼륨(0~1) — MMKV에 저장해 세션 간 유지
  const [volume, setVolumeState] = useState(() => {
    const v = storage.getNumber('voiceVolume')
    return v == null ? 1 : v
  })
  // 통역 음성 On/Off — 화자별 구분. 상대 발화 통역(내 언어로 들림) / 내 발화 통역(상대에게 들려줌)
  const [otherVoice, setOtherVoice] = useState(() => {
    const v = storage.getBoolean('voiceOther')
    return v == null ? true : v
  })
  const [myVoice, setMyVoice] = useState(() => {
    const v = storage.getBoolean('voiceMine')
    return v == null ? true : v
  })
  // 이어폰 연결 시 에코 누설이 없으므로 동시 발화 게이트를 끈다(완전 동시 통역)
  const [headset, setHeadset] = useState(false)
  // 이어폰 중 '내 발화 통역'을 스피커로 내보내 상대가 듣게 함.
  // 기본 ON: 이어폰 통역의 자연스러운 흐름(상대 말은 이어폰으로 나만, 내 말은 스피커로 상대에게)
  const [speakerMyVoice, setSpeakerMyVoice] = useState(
    () => storage.getBoolean('speakerMyVoice') ?? true,
  )
  const scrollRef = useRef<ScrollView>(null)

  const sessionRef = useRef<LiveSession | null>(null)
  const micRef = useRef<MicHandle | null>(null)
  const playerRef = useRef<Player | null>(null)
  const idRef = useRef(0)
  // 자동 재연결 상태 — 의도적 종료(stop/X)와 비정상 종료를 구분
  const intentionalCloseRef = useRef(false)
  const reconnectingRef = useRef(false)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 직전에 명확히 감지된 발화 언어 — 감지 실패(미상) 시 직전 언어를 유지해
  // 말풍선 색·국기·라우팅이 🌐로 튀지 않게 한다(대화 연속성).
  const lastLangRef = useRef('')
  // 언어 판정 우선순위: Gemini 감지 코드 > 스크립트 휴리스틱 > 직전 언어 > 앱 언어.
  // Gemini가 코드를 안 줄 때(preview)도 동작하도록 detectLang을 폴백으로 유지.
  const resolveLang = (s: string, geminiCode?: string): string =>
    normalizeLang(geminiCode) || detectLang(s) || lastLangRef.current || appLang
  // turn id → 통역 음성 PCM (다시 듣기용)
  const audioStoreRef = useRef<Map<number, Uint8Array>>(new Map())
  // 이력 저장용 — 콜백/언마운트에서 최신값 읽기
  const turnsRef = useRef<Turn[]>([])
  const appLangRef = useRef(appLang)
  useEffect(() => {
    turnsRef.current = turns
  }, [turns])
  useEffect(() => {
    appLangRef.current = appLang
  }, [appLang])

  // 현재 대화를 이력에 저장(빈 대화는 무시)
  const persist = () => {
    saveSession(
      turnsRef.current.map((x) => ({
        original: x.original,
        translation: x.translation,
        lang: x.lang,
      })),
      appLangRef.current,
    )
  }
  // onAudio/마이크 콜백 클로저에서 최신 On/Off 값을 읽기 위한 미러
  const otherVoiceRef = useRef(otherVoice)
  const myVoiceRef = useRef(myVoice)
  const headsetRef = useRef(false)
  const routeSubRef = useRef<{ remove: () => void } | null>(null)
  const speakerMyVoiceRef = useRef(speakerMyVoice)
  // 현재 출력이 스피커로 라우팅됐는지(중복 호출 방지)
  const routedToSpeakerRef = useRef(false)

  // 출력 라우팅 전환(내 통역=스피커, 상대 통역=이어폰). 변경 시에만 네이티브 호출.
  // 전환 직후 재생을 잠시 미뤄(delayNext) 라우팅/모드 전환이 안정화될 시간을 줘서
  // 통역 음성 앞부분이 잘리는 것을 방지한다.
  const applySpeakerRoute = (toSpeaker: boolean) => {
    if (routedToSpeakerRef.current === toSpeaker) return
    routedToSpeakerRef.current = toSpeaker
    setSpeaker(toSpeaker)
    // 전환 직후 무음 재생으로 출력 경로를 깨워 통역 음성 앞부분 잘림 방지.
    // 기기 청취: 스피커 전환(내 통역)에서 잘림 발생, 이어폰(상대 통역)은 문제 없음.
    // → 스피커는 길게(1.0), 이어폰은 짧게(0.65).
    playerRef.current?.primeSilence(toSpeaker ? 1.0 : 0.65)
  }

  // 이어폰 연결 상태 갱신(초기 조회 + 라우팅 변경 시)
  const refreshHeadset = () => {
    isHeadsetConnected().then((v) => {
      setHeadset(v)
      headsetRef.current = v
    })
  }

  const teardown = () => {
    // 의도적 종료 — 자동 재연결 중단
    intentionalCloseRef.current = true
    reconnectingRef.current = false
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    micRef.current?.stop()
    micRef.current = null
    sessionRef.current?.close()
    sessionRef.current = null
    playerRef.current?.close()
    playerRef.current = null
    routeSubRef.current?.remove()
    routeSubRef.current = null
    routedToSpeakerRef.current = false
    resetSpeaker() // 오디오 라우팅 원복
    audioStoreRef.current.clear()
  }

  // '내 통역 스피커 출력' 토글 — 끄면 즉시 이어폰 복귀
  const toggleSpeakerMyVoice = () => {
    const next = !speakerMyVoice
    setSpeakerMyVoice(next)
    speakerMyVoiceRef.current = next
    storage.set('speakerMyVoice', next)
    if (!next) {
      routedToSpeakerRef.current = false
      resetSpeaker()
    }
  }

  // 볼륨 변경 — 재생 중 즉시 반영(state+player), 슬라이딩 종료 시 MMKV 저장
  const onVolumeChange = (v: number) => {
    setVolumeState(v)
    playerRef.current?.setVolume(v)
  }
  const onVolumeCommit = (v: number) => storage.set('voiceVolume', v)

  // 화자별 통역 음성 On/Off 토글 — 즉시 반영(ref) + MMKV 저장
  const toggleOtherVoice = () => {
    const next = !otherVoice
    setOtherVoice(next)
    otherVoiceRef.current = next
    storage.set('voiceOther', next)
  }
  const toggleMyVoice = () => {
    const next = !myVoice
    setMyVoice(next)
    myVoiceRef.current = next
    storage.set('voiceMine', next)
  }

  // 말풍선 통역 음성 다시 듣기 (음성 Off여도 명시적 액션이므로 재생)
  const replay = (id: number) => {
    const pcm = audioStoreRef.current.get(id)
    if (pcm) playerRef.current?.playNow(pcm)
  }

  // 세션 비정상 종료 시 자동 재연결(의도적 종료 제외). 초과 시 에러 화면.
  // reconnectingRef로 중복 진입 차단(close()가 다시 closed 콜백을 부르는 경우 대비).
  const scheduleReconnect = () => {
    if (intentionalCloseRef.current || reconnectingRef.current) return
    reconnectingRef.current = true
    sessionRef.current?.close()
    sessionRef.current = null
    if (reconnectAttemptRef.current >= MAX_RECONNECT) {
      reconnectingRef.current = false
      failToFallback()
      return
    }
    reconnectAttemptRef.current += 1
    setStatus('reconnecting')
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = setTimeout(() => {
      reconnectingRef.current = false
      connect().then((ok) => {
        if (!ok && !intentionalCloseRef.current) scheduleReconnect()
      })
    }, RECONNECT_DELAY_MS)
  }

  // 세션 연결 — start(신규)와 자동 재연결이 공유. 성공 시 true.
  // mic/player는 이미 있으면 유지(재연결 시 대화·재생 큐 보존).
  async function connect(): Promise<boolean> {
    try {
      const session = await startLiveTranslate(
        { appLang },
        {
          onStatus: (s) => {
            if (s === 'open') {
              setStatus('connected')
              reconnectAttemptRef.current = 0
              if (!playerRef.current) playerRef.current = createPlayer(24000, volume)
              if (!micRef.current) {
                micRef.current = startMic((pcm) => {
                  if (playerRef.current?.isPlaying()) {
                    // 스피커 모드(이어폰 미사용): 내 발화·상대 발화가 모두 큰 볼륨으로 스피커에
                    // 나가 누설 RMS가 임계를 넘으면 RMS 게이트를 통과해 무한 재번역됨.
                    // → 통역 재생 중 마이크 입력을 전부 차단하는 원본 half-duplex로 되먹임을 차단.
                    if (!headsetRef.current) return
                    // 이어폰 + 내 통역 스피커 출력 중: 누설이 제한적이라 임계 이하만 차단해
                    // 동시 발화를 허용(이어폰 경로 기존 로직 유지 — 변경하지 않음).
                    if (
                      speakerMyVoiceRef.current &&
                      routedToSpeakerRef.current &&
                      rms16(pcm) < SPEECH_RMS_GATE
                    )
                      return
                  }
                  sessionRef.current?.sendAudio(pcm)
                })
              }
            } else if (s === 'error' || s === 'closed') {
              scheduleReconnect()
            }
          },
          onTurn: (turn) => {
            // 선제 라우팅 — 원문(자막)이 통역 음성보다 먼저 도착하므로, 화자가 정해지는
            // 즉시 출력 라우팅을 전환해 음성 도착 전 전환을 끝낸다(앞부분 잘림 방지).
            if (headsetRef.current && speakerMyVoiceRef.current) {
              const src = turn.original || turn.translation
              if (src) applySpeakerRoute(resolveLang(src, turn.lang) === appLang)
            }
            if (turn.final) {
              setCurrent(null)
              // 통역이 비면(언어 감지 실패 등) 그 turn은 건너뛴다 — 빈/불완전 말풍선 방지
              if (turn.translation.trim()) {
                idRef.current += 1
                const orig = turn.original.trim()
                // Gemini 감지 코드 우선, 없으면 스크립트 감지. 명확하면 직전 언어 갱신.
                const detected = normalizeLang(turn.lang) || detectLang(orig)
                if (detected) lastLangRef.current = detected
                const lang = detected || lastLangRef.current || appLang
                if (turn.audio) audioStoreRef.current.set(idRef.current, turn.audio)
                setTurns((prev) =>
                  [
                    ...prev,
                    {
                      id: idRef.current,
                      original: orig,
                      translation: turn.translation.trim(),
                      lang,
                      hasAudio: !!turn.audio,
                    },
                  ].slice(-40),
                )
              }
            } else {
              setCurrent({
                original: turn.original,
                translation: turn.translation,
                lang: resolveLang(turn.original, turn.lang),
              })
            }
          },
          onAudio: (pcm24, sourceText, sourceLang) => {
            // 화자 판단: 원문이 앱 언어면 내 발화 통역, 아니면 상대 발화 통역(미상이면 직전 유지)
            const isMine = resolveLang(sourceText, sourceLang) === appLang
            const enabled = isMine ? myVoiceRef.current : otherVoiceRef.current
            if (!enabled) return
            // 이어폰 + 토글 ON: 내 통역은 스피커(상대에게), 상대 통역은 이어폰(나에게)
            if (headsetRef.current && speakerMyVoiceRef.current) applySpeakerRoute(isMine)
            playerRef.current?.play(pcm24)
          },
        },
      )
      if (!session) return false
      sessionRef.current = session
      return true
    } catch {
      return false
    }
  }

  const start = async () => {
    intentionalCloseRef.current = false
    reconnectAttemptRef.current = 0
    setStatus('connecting')
    setTurns([])
    setCurrent(null)
    if (!(await ensureMicPermission())) {
      setStatus('error')
      return
    }
    // 이어폰 연결 여부 초기 조회 + 라우팅 변경 구독(연결/해제 시 게이트 자동 전환)
    refreshHeadset()
    routeSubRef.current = observeRouteChange(refreshHeadset)
    const ok = await connect()
    if (ok) setActive(true)
    else setStatus('unavailable')
  }

  const stop = () => {
    persist()
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

  // 언마운트(X 닫기 등) 시에도 미저장 대화 보존
  useEffect(
    () => () => {
      persist()
      teardown()
    },
    [],
  )

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
          <Pressable onPress={() => router.push('/voice-history')} style={ss.close}>
            <Icon name="history" size={18} color={palette.zinc[700]} />
          </Pressable>
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
                {status === 'connected'
                  ? t('voice.listening')
                  : status === 'reconnecting'
                    ? t('voice.reconnecting')
                    : t('voice.connecting')}
              </Text>
              {headset && <Icon name="headphones" size={13} color={palette.teal[40]} filled />}
            </View>

            <View style={ss.settingsCard}>
              {/* 상대 음성 — 이어폰으로 들림 */}
              <ToggleRow
                icon={otherVoice ? 'volume_up' : 'volume_off'}
                label={t('voice.soundOther')}
                value={otherVoice}
                onToggle={toggleOtherVoice}
              />
              <View style={ss.rowDivider} />
              {/* 내 통역 — On/Off + (이어폰 시)출력처 칩(이어폰/스피커 전환) 통합 */}
              <View style={ss.toggleRow}>
                <View style={ss.toggleLabelGroup}>
                  <Icon
                    name={
                      !myVoice
                        ? 'volume_off'
                        : headset && !speakerMyVoice
                          ? 'headphones'
                          : 'megaphone'
                    }
                    size={18}
                    color={
                      !myVoice
                        ? palette.zinc[400]
                        : speakerMyVoice
                          ? palette.coral[40]
                          : palette.teal[40]
                    }
                    filled
                  />
                  <Text style={[ss.toggleLabel, !myVoice && { color: palette.zinc[400] }]}>
                    {t('voice.soundMine')}
                  </Text>
                </View>
                <View style={ss.rowControls}>
                  {headset && myVoice && (
                    <Pressable
                      onPress={toggleSpeakerMyVoice}
                      hitSlop={6}
                      style={[
                        ss.outputChip,
                        {
                          backgroundColor: speakerMyVoice ? palette.coral[95] : palette.teal[95],
                        },
                      ]}>
                      <Icon
                        name={speakerMyVoice ? 'megaphone' : 'headphones'}
                        size={13}
                        color={speakerMyVoice ? palette.coral[40] : palette.teal[40]}
                        filled
                      />
                      <Text
                        style={[
                          ss.outputChipText,
                          { color: speakerMyVoice ? palette.coral[40] : palette.teal[40] },
                        ]}>
                        {speakerMyVoice ? t('voice.outSpeaker') : t('voice.outEarphone')}
                      </Text>
                    </Pressable>
                  )}
                  <Switch
                    value={myVoice}
                    onValueChange={toggleMyVoice}
                    trackColor={{ true: palette.teal[80], false: palette.zinc[300] }}
                    thumbColor={myVoice ? palette.teal[40] : '#f4f4f5'}
                  />
                </View>
              </View>
              <View style={ss.rowDivider} />
              {/* 볼륨 */}
              <View style={ss.volumeRow}>
                <Icon
                  name="volume_up"
                  size={16}
                  color={otherVoice || myVoice ? palette.teal[40] : palette.zinc[400]}
                  filled
                />
                <Slider
                  style={[ss.slider, !(otherVoice || myVoice) && { opacity: 0.35 }]}
                  disabled={!(otherVoice || myVoice)}
                  minimumValue={0}
                  maximumValue={1}
                  value={volume}
                  onValueChange={onVolumeChange}
                  onSlidingComplete={onVolumeCommit}
                  minimumTrackTintColor={palette.teal[40]}
                  maximumTrackTintColor={palette.zinc[200]}
                  thumbTintColor={palette.teal[40]}
                />
                <Text style={[ss.volPct, !(otherVoice || myVoice) && { color: palette.zinc[400] }]}>
                  {Math.round(volume * 100)}%
                </Text>
              </View>
            </View>

            <ScrollView
              ref={scrollRef}
              style={{ flex: 1, marginTop: 12 }}
              contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
              {empty ? (
                <View style={{ alignItems: 'center', marginTop: 40, gap: 16 }}>
                  <Text style={ss.hint}>{t('voice.hint')}</Text>
                  <Pressable
                    onPress={() => router.replace('/(tabs)/translate')}
                    style={ss.toTextBtn}>
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
                      onReplay={tn.hasAudio ? () => replay(tn.id) : undefined}
                    />
                  ))}
                  {!!current && (current.original || current.translation) && (
                    <Bubble
                      original={current.original}
                      translation={current.translation}
                      lang={current.lang}
                      isMe={current.lang === appLang}
                      dim
                    />
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
                <Pressable onPress={() => router.replace('/(tabs)/translate')} style={ss.altBtn}>
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
                    <Pressable
                      onPress={() => router.replace('/(tabs)/translate')}
                      style={ss.altBtn}>
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

  // 출력 설정 카드 (컴팩트)
  settingsCard: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    paddingHorizontal: 14,
    ...shadows.card,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
  },
  toggleLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: palette.zinc[800] },
  rowControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  outputChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  outputChipText: { fontSize: 11, fontWeight: '700' },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.zinc[200] },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
  },
  slider: { flex: 1, height: 32 },
  volPct: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.zinc[500],
    width: 34,
    textAlign: 'right',
  },
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
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 5,
  },
  speakerChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  replayBtn: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
