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

type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'unavailable'

// 동시 발화 게이트 임계 — 통역 재생 중 이 RMS 이상의 입력만 통과(실제 발화 vs 에코 누설).
// 기기 실측 결과 스피커 누설 피크가 ~0.044라, 그 위인 0.05로 설정(누설 차단 + 발화 통과).
// 낮출수록 동시 발화 감지↑·에코 차단↓. 스피커 볼륨이 크면 누설도 커짐 → 이어폰 권장.
const SPEECH_RMS_GATE = 0.05
// lang: 감지된 발화 언어 코드. 화자(언어)별 색상·정렬·칩에 사용.
// hasAudio: 통역 음성 보유 여부(다시 듣기 버튼 표시용. PCM은 audioStoreRef에 보관).
type Turn = { id: number; original: string; translation: string; lang: string; hasAudio: boolean }

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
  const [current, setCurrent] = useState<{ original: string; translation: string } | null>(null)
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
  const applySpeakerRoute = (toSpeaker: boolean) => {
    if (routedToSpeakerRef.current === toSpeaker) return
    routedToSpeakerRef.current = toSpeaker
    setSpeaker(toSpeaker)
  }

  // 이어폰 연결 상태 갱신(초기 조회 + 라우팅 변경 시)
  const refreshHeadset = () => {
    isHeadsetConnected().then((v) => {
      setHeadset(v)
      headsetRef.current = v
    })
  }

  const teardown = () => {
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

  const start = async () => {
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
    try {
      const session = await startLiveTranslate(
        { appLang },
        {
          onStatus: (s) => {
            if (s === 'open') {
              setStatus('connected')
              playerRef.current = createPlayer(24000, volume)
              micRef.current = startMic((pcm) => {
                // 에코 게이트는 '지금 소리가 스피커로 나가는 구간'에서만 적용한다(케이스별):
                // - 스피커 모드(이어폰 없음): 항상 스피커 → 게이트 ON
                // - 이어폰 + 내 통역 스피커 출력 ON + 내 통역 재생 중(routedToSpeaker): 스피커 → ON
                // - 이어폰으로만 나가는 구간(상대 통역 등): 누설 없음 → 게이트 OFF(완전 동시 발화)
                const speakerOut =
                  !headsetRef.current || (speakerMyVoiceRef.current && routedToSpeakerRef.current)
                if (speakerOut && playerRef.current?.isPlaying() && rms16(pcm) < SPEECH_RMS_GATE)
                  return
                sessionRef.current?.sendAudio(pcm)
              })
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
                if (turn.audio) audioStoreRef.current.set(idRef.current, turn.audio)
                setTurns((prev) =>
                  [
                    ...prev,
                    {
                      id: idRef.current,
                      original: orig,
                      translation: turn.translation.trim(),
                      lang: detectLang(orig),
                      hasAudio: !!turn.audio,
                    },
                  ].slice(-40),
                )
              }
            } else {
              setCurrent({ original: turn.original, translation: turn.translation })
            }
          },
          onAudio: (pcm24, sourceText) => {
            // 화자 판단: 원문이 앱 언어면 내 발화 통역, 아니면 상대 발화 통역
            const isMine = detectLang(sourceText) === appLang
            const enabled = isMine ? myVoiceRef.current : otherVoiceRef.current
            if (!enabled) return
            // 이어폰 + 토글 ON: 내 통역은 스피커(상대에게), 상대 통역은 이어폰(나에게)
            if (headsetRef.current && speakerMyVoiceRef.current) applySpeakerRoute(isMine)
            playerRef.current?.play(pcm24)
          },
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
                {status === 'connected' ? t('voice.listening') : t('voice.connecting')}
              </Text>
            </View>

            <View style={ss.settingsCard}>
              {/* 출력 모드 헤더 — 이어폰/스피커에 따라 아이콘·색상 변경 */}
              <View
                style={[
                  ss.outputHeader,
                  { backgroundColor: headset ? palette.teal[95] : palette.amber[90] },
                ]}>
                <Icon
                  name={headset ? 'headphones' : 'volume_up'}
                  size={16}
                  color={headset ? palette.teal[40] : palette.amber[50]}
                  filled
                />
                <Text
                  style={[
                    ss.outputLabel,
                    { color: headset ? palette.teal[40] : palette.amber[50] },
                  ]}>
                  {headset ? t('voice.headsetMode') : t('voice.speakerMode')}
                </Text>
              </View>

              <View style={ss.cardBody}>
                <ToggleRow
                  icon={otherVoice ? 'volume_up' : 'volume_off'}
                  label={t('voice.soundOther')}
                  value={otherVoice}
                  onToggle={toggleOtherVoice}
                />
                <View style={ss.rowDivider} />
                <ToggleRow
                  icon={myVoice ? 'volume_up' : 'volume_off'}
                  label={t('voice.soundMine')}
                  value={myVoice}
                  onToggle={toggleMyVoice}
                />
                {headset && (
                  <>
                    <View style={ss.rowDivider} />
                    <ToggleRow
                      icon={speakerMyVoice ? 'megaphone' : 'headphones'}
                      label={t('voice.myVoiceToSpeaker')}
                      value={speakerMyVoice}
                      onToggle={toggleSpeakerMyVoice}
                      accent={palette.coral[40]}
                    />
                  </>
                )}
                <View style={ss.rowDivider} />
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
                  <Text
                    style={[ss.volPct, !(otherVoice || myVoice) && { color: palette.zinc[400] }]}>
                    {Math.round(volume * 100)}%
                  </Text>
                </View>
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
                      onReplay={tn.hasAudio ? () => replay(tn.id) : undefined}
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

  // 출력 설정 카드
  settingsCard: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    overflow: 'hidden',
    ...shadows.card,
  },
  outputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  outputLabel: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.2 },
  cardBody: { paddingHorizontal: 14 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  toggleLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: palette.zinc[800] },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.zinc[200] },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
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
