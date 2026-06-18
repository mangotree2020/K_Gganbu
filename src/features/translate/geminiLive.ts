// Gemini Live API 직결 클라이언트 (PLANNING §25 B안 — LiveKit/Agent 불필요)
// 기기 ↔ Gemini Live(BidiGenerateContent WS) 직접 연결. 키는 ephemeral 토큰으로 보호.
// 오디오 캡처/재생(네이티브 PCM)은 호출측에서 sendAudio/onAudio 로 연결한다.
import { supabase } from '@/lib/supabase'

export type LiveStatus = 'connecting' | 'open' | 'closed' | 'error'

export type LiveCallbacks = {
  // source=true: 화자 원문 인식, false: 번역 결과
  onTranscript?: (text: string, opts: { final: boolean; source: boolean }) => void
  onAudio?: (pcm24: Uint8Array) => void // 24kHz PCM 번역 음성
  onStatus?: (s: LiveStatus) => void
}

export type LiveSession = {
  sendAudio: (pcm16: Uint8Array) => void // 16kHz PCM 입력
  close: () => void
}

type TokenGrant = { token: string; wsHost: string; model: string }

async function getLiveToken(sourceLang: string, targetLang: string): Promise<TokenGrant | null> {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-live-token', {
      body: { sourceLang, targetLang },
    })
    if (error) throw error
    if (data?.token && data?.wsHost && data?.model) return data as TokenGrant
    return null
  } catch {
    return null
  }
}

function toB64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  // RN 전역 btoa 사용 (Hermes 제공)
  return globalThis.btoa(bin)
}

function fromB64(b64: string): Uint8Array {
  const bin = globalThis.atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// Gemini Live 통역 세션 시작. 토큰 미발급(키 미설정) 시 null 반환 → UI 폴백.
export async function startLiveTranslate(
  opts: { sourceLang?: string; targetLang: string },
  cb: LiveCallbacks,
): Promise<LiveSession | null> {
  const grant = await getLiveToken(opts.sourceLang ?? 'auto', opts.targetLang)
  if (!grant) return null

  cb.onStatus?.('connecting')
  const url = `wss://${grant.wsHost}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?access_token=${grant.token}`
  const ws = new WebSocket(url)

  ws.onopen = () => {
    // 세션 설정 — speech-to-speech 통역(translate-preview). 실측 검증된 형식:
    // model + responseModalities AUDIO + speechConfig.languageCode(대상 언어) + 입출력 transcription.
    // (translateConfig/targetLanguageCode 필드는 API가 거부하므로 사용하지 않음)
    ws.send(
      JSON.stringify({
        setup: {
          model: grant.model,
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { languageCode: opts.targetLang },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      }),
    )
    // 연결됨 — 단, 오디오 전송은 setupComplete 수신 후 시작
  }

  ws.onmessage = (ev: WebSocketMessageEvent) => {
    try {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '')
      // setup 완료 → 이제 오디오 송신 가능
      if (msg.setupComplete) {
        cb.onStatus?.('open')
        return
      }
      const sc = msg.serverContent
      if (sc?.inputTranscription?.text) {
        cb.onTranscript?.(sc.inputTranscription.text, {
          final: !!sc.inputTranscription.finished,
          source: true,
        })
      }
      if (sc?.outputTranscription?.text) {
        cb.onTranscript?.(sc.outputTranscription.text, {
          final: !!sc.outputTranscription.finished,
          source: false,
        })
      }
      const parts = sc?.modelTurn?.parts ?? []
      for (const p of parts) {
        if (p.inlineData?.data) cb.onAudio?.(fromB64(p.inlineData.data))
      }
    } catch {
      // 비정상 프레임 무시
    }
  }

  ws.onerror = () => cb.onStatus?.('error')
  ws.onclose = () => cb.onStatus?.('closed')

  return {
    sendAudio: (pcm16: Uint8Array) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: toB64(pcm16) } },
          }),
        )
      }
    },
    close: () => {
      try {
        ws.close()
      } catch {
        // 무시
      }
    },
  }
}
