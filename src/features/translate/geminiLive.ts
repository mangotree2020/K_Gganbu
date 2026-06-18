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

const WS_HOST = 'generativelanguage.googleapis.com'
const MODEL = 'models/gemini-3.5-live-translate-preview'
// 개발용 직접 키(테스트 전용) — 있으면 Supabase 토큰 없이 직결. 프로덕션은 비워둔다.
const DEV_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY

type TokenGrant = { auth: string; isKey: boolean; wsHost: string; model: string }

async function getLiveToken(sourceLang: string, targetLang: string): Promise<TokenGrant | null> {
  // 개발: 직접 키로 연결(?key=). 프로덕션: Supabase ephemeral 토큰(?access_token=).
  if (DEV_KEY) return { auth: DEV_KEY, isKey: true, wsHost: WS_HOST, model: MODEL }
  try {
    const { data, error } = await supabase.functions.invoke('gemini-live-token', {
      body: { sourceLang, targetLang },
    })
    if (error) throw error
    if (data?.token && data?.wsHost && data?.model)
      return { auth: data.token as string, isKey: false, wsHost: data.wsHost, model: data.model }
    return null
  } catch {
    return null
  }
}

// UTF-8 디코드 (한글 등 멀티바이트) — Gemini Live WS는 RN에서 ArrayBuffer 프레임으로 옴
function utf8Decode(ab: ArrayBuffer): string {
  const b = new Uint8Array(ab)
  let out = ''
  let i = 0
  while (i < b.length) {
    const c = b[i++]
    if (c < 0x80) out += String.fromCharCode(c)
    else if (c < 0xe0) out += String.fromCharCode(((c & 0x1f) << 6) | (b[i++] & 0x3f))
    else if (c < 0xf0)
      out += String.fromCharCode(((c & 0x0f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f))
    else {
      let cp =
        ((c & 0x07) << 18) | ((b[i++] & 0x3f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f)
      cp -= 0x10000
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff))
    }
  }
  return out
}

// WS 프레임(string | ArrayBuffer) → 텍스트
function frameToText(data: unknown): string {
  if (typeof data === 'string') return data
  if (data instanceof ArrayBuffer) return utf8Decode(data)
  const view = data as ArrayBufferView | undefined
  if (view?.buffer) return utf8Decode(view.buffer as ArrayBuffer)
  return ''
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
  const apiVer = grant.isKey ? 'v1beta' : 'v1alpha'
  const authParam = grant.isKey ? `key=${grant.auth}` : `access_token=${grant.auth}`
  const url = `wss://${grant.wsHost}/ws/google.ai.generativelanguage.${apiVer}.GenerativeService.BidiGenerateContent?${authParam}`
  const ws = new WebSocket(url)
  ws.binaryType = 'arraybuffer'

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
      const raw = frameToText(ev.data)
      if (!raw) return
      const msg = JSON.parse(raw)
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
