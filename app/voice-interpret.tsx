// 음성 통역 화면 (PLANNING §25) — LiveKit Room + Gemini Live Agent
// 토큰: livekit-token Edge Function. 키/Agent 미설정 시 폴백 안내.
// useRoomContext는 @livekit/react-native가 components-react에서 re-export (직접 의존성으로 통일)
import { AudioSession, LiveKitRoom, registerGlobals, useRoomContext } from '@livekit/react-native'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RoomEvent } from 'livekit-client'

import { Icon } from '@/components/brand'
import { getVoiceToken, type LiveKitGrant } from '@/features/translate/voice'
import { useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

// WebRTC 전역 등록 (LiveKit RN 필수)
registerGlobals()

type Line = { id: string; text: string; final: boolean; mine: boolean }

// Room 내부: transcript 수신 (원문/번역 분할 표시)
function Transcripts({ onLines }: { onLines: (fn: (prev: Line[]) => Line[]) => void }) {
  const room = useRoomContext()
  useEffect(() => {
    const handler = (
      segments: { id: string; text: string; final: boolean }[],
      participant?: { isLocal?: boolean },
    ) => {
      const mine = !!participant?.isLocal
      onLines((prev) => {
        const next = [...prev]
        for (const s of segments) {
          const idx = next.findIndex((l) => l.id === s.id)
          const line = { id: s.id, text: s.text, final: s.final, mine }
          if (idx >= 0) next[idx] = line
          else next.push(line)
        }
        return next.slice(-30)
      })
    }
    room.on(RoomEvent.TranscriptionReceived, handler as never)
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handler as never)
    }
  }, [room, onLines])
  return null
}

type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'unavailable'

// Room 연결 상태 감시 — 약한 네트워크 재연결/끊김 반영 (PLANNING §25 리스크)
function ConnectionWatch({
  onReconnecting,
  onReconnected,
  onDisconnected,
}: {
  onReconnecting: () => void
  onReconnected: () => void
  onDisconnected: () => void
}) {
  const room = useRoomContext()
  useEffect(() => {
    room.on(RoomEvent.Reconnecting, onReconnecting)
    room.on(RoomEvent.Reconnected, onReconnected)
    room.on(RoomEvent.Disconnected, onDisconnected)
    return () => {
      room.off(RoomEvent.Reconnecting, onReconnecting)
      room.off(RoomEvent.Reconnected, onReconnected)
      room.off(RoomEvent.Disconnected, onDisconnected)
    }
  }, [room, onReconnecting, onReconnected, onDisconnected])
  return null
}

export default function VoiceInterpretScreen() {
  const t = useT()
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [grant, setGrant] = useState<LiveKitGrant | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const scrollRef = useRef<ScrollView>(null)

  const start = async () => {
    setStatus('connecting')
    try {
      // 마이크 권한 just-in-time — 거부 시 startAudioSession이 throw → 폴백 안내
      await AudioSession.startAudioSession()
      const g = await getVoiceToken({ sourceLang: 'auto', targetLang: 'ko' })
      if (!g) {
        await AudioSession.stopAudioSession()
        setStatus('unavailable') // 키/Agent 미설정 → 폴백 안내
        return
      }
      setGrant(g)
    } catch {
      // 권한 거부·토큰 발급 실패·네트워크 오류 → 'connecting' 고착 방지, 폴백 노출
      await AudioSession.stopAudioSession().catch(() => {})
      setStatus('error')
    }
  }

  const stop = async () => {
    setGrant(null)
    setLines([])
    await AudioSession.stopAudioSession()
    setStatus('idle')
  }

  // preview 끊김/오류 → 세션 정리 후 텍스트 번역 폴백 안내로 전환
  const failToFallback = async () => {
    setGrant(null)
    setLines([])
    await AudioSession.stopAudioSession().catch(() => {})
    setStatus('error')
  }

  useEffect(() => {
    return () => {
      AudioSession.stopAudioSession().catch(() => {})
    }
  }, [])

  return (
    <View style={ss.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* 헤더 */}
        <View style={ss.header}>
          <View style={ss.headerIcon}>
            <Icon name="mic" size={20} color={palette.teal[40]} filled />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ss.title}>{t('voice.title')}</Text>
            <Text style={ss.sub}>Real-time ko↔ via Gemini Live</Text>
          </View>
          <Pressable onPress={() => router.back()} style={ss.close}>
            <Icon name="close" size={18} color={palette.zinc[700]} />
          </Pressable>
        </View>

        {grant ? (
          <LiveKitRoom
            serverUrl={grant.url ?? undefined}
            token={grant.token}
            connect
            audio
            video={false}
            onConnected={() => setStatus('connected')}
            onError={() => failToFallback()}>
            <Transcripts onLines={setLines} />
            <ConnectionWatch
              onReconnecting={() => setStatus('reconnecting')}
              onReconnected={() => setStatus('connected')}
              onDisconnected={() => failToFallback()}
            />
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
              </View>

              <ScrollView
                ref={scrollRef}
                style={{ flex: 1, marginTop: 12 }}
                contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
                {lines.length === 0 ? (
                  <Text style={ss.hint}>{t('voice.hint')}</Text>
                ) : (
                  lines.map((l) => (
                    <View
                      key={l.id}
                      style={[
                        ss.bubble,
                        l.mine ? ss.mine : ss.theirs,
                        { opacity: l.final ? 1 : 0.6 },
                      ]}>
                      <Text style={[ss.bubbleText, l.mine && { color: '#fff' }]}>{l.text}</Text>
                    </View>
                  ))
                )}
              </ScrollView>

              <Pressable onPress={stop} style={ss.stopBtn}>
                <Icon name="close" size={18} color="#fff" />
                <Text style={ss.stopText}>{t('voice.end')}</Text>
              </Pressable>
            </View>
          </LiveKitRoom>
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
  hint: { fontSize: 13, color: palette.zinc[400], textAlign: 'center', marginTop: 40 },
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
    ...shadows.card,
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
