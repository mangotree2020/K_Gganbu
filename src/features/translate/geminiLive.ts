// Gemini Live API 직결 클라이언트 (PLANNING §25 B안 — LiveKit/Agent 불필요)
// 기기 ↔ Gemini Live(BidiGenerateContent WS) 직접 연결. 키는 ephemeral 토큰으로 보호.
// 양방향 자동 통역: 외국인 발화→한국어, 한국어 발화→외국인 언어 (입력 언어 자동 감지).
// 오디오 캡처/재생(네이티브 PCM)은 호출측에서 sendAudio/onAudio 로 연결한다.
import { supabase } from '@/lib/supabase'

export type LiveStatus = 'connecting' | 'open' | 'closed' | 'error'

// 한 turn = 화자 원문 + 통역 결과 (대화형 말풍선용)
export type Turn = { original: string; translation: string; final: boolean }

export type LiveCallbacks = {
  onTurn?: (turn: Turn) => void
  onAudio?: (pcm24: Uint8Array) => void // 24kHz PCM 통역 음성
  onStatus?: (s: LiveStatus) => void
}

export type LiveSession = {
  sendAudio: (pcm16: Uint8Array) => void // 16kHz PCM 입력
  close: () => void
}

const WS_HOST = 'generativelanguage.googleapis.com'
// 범용 Live 모델 — systemInstruction으로 양방향 통역 제어(언어 자동 감지).
// (translate-preview는 KO→EN 고정이라 양방향 불가 → flash-live 채택)
const MODEL = 'models/gemini-3.1-flash-live-preview'
// 개발용 직접 키(테스트 전용) — 있으면 Supabase 토큰 없이 직결. 프로덕션은 비워둔다.
const DEV_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY

// 외국인측 언어 코드 → 영어 이름(systemInstruction용)
const LANG_NAME: Record<string, string> = {
  en: 'English',
  ja: 'Japanese',
  'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  ko: 'English',
}

function interpreterInstruction(foreignerLang: string): string {
  const name = LANG_NAME[foreignerLang] ?? 'English'
  // 목표 언어 = 앱 설정 언어(name). 발화 언어 자동 감지:
  // 앱 언어 발화 → 한국어, 그 외(한국어 포함 모든 언어) → 앱 언어.
  return (
    `You are a live two-way interpreter for a ${name}-speaking traveler in Korea. ` +
    `Detect the spoken language of each utterance automatically. ` +
    `If the utterance is in ${name}, translate it into natural spoken Korean. ` +
    `If the utterance is in Korean or any other language, translate it into natural spoken ${name}. ` +
    `Reply with ONLY the translation — no notes, no language labels, no extra words.`
  )
}

type TokenGrant = { auth: string; isKey: boolean; wsHost: string; model: string }

async function getLiveToken(foreignerLang: string): Promise<TokenGrant | null> {
  // 개발: 직접 키로 연결(?key=). 프로덕션: Supabase ephemeral 토큰(?access_token=).
  if (DEV_KEY) return { auth: DEV_KEY, isKey: true, wsHost: WS_HOST, model: MODEL }
  try {
    const { data, error } = await supabase.functions.invoke('gemini-live-token', {
      body: { foreignerLang },
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
  return globalThis.btoa(bin)
}

function fromB64(b64: string): Uint8Array {
  const bin = globalThis.atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// Gemini Live 양방향 통역 세션 시작. 토큰 미발급(키 미설정) 시 null 반환 → UI 폴백.
export async function startLiveTranslate(
  opts: { foreignerLang: string },
  cb: LiveCallbacks,
): Promise<LiveSession | null> {
  const grant = await getLiveToken(opts.foreignerLang)
  if (!grant) return null

  cb.onStatus?.('connecting')
  const apiVer = grant.isKey ? 'v1beta' : 'v1alpha'
  const authParam = grant.isKey ? `key=${grant.auth}` : `access_token=${grant.auth}`
  const url = `wss://${grant.wsHost}/ws/google.ai.generativelanguage.${apiVer}.GenerativeService.BidiGenerateContent?${authParam}`
  const ws = new WebSocket(url)
  ws.binaryType = 'arraybuffer'

  // 현재 turn 누적 버퍼 (원문/통역)
  let origBuf = ''
  let transBuf = ''

  ws.onopen = () => {
    // 세션 설정 — 양방향 통역(systemInstruction). AUDIO 출력 + 원문/통역 transcription.
    ws.send(
      JSON.stringify({
        setup: {
          model: grant.model,
          generationConfig: { responseModalities: ['AUDIO'] },
          systemInstruction: { parts: [{ text: interpreterInstruction(opts.foreignerLang) }] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      }),
    )
    // 오디오 전송은 setupComplete 수신 후 시작
  }

  ws.onmessage = (ev: WebSocketMessageEvent) => {
    try {
      const raw = frameToText(ev.data)
      if (!raw) return
      const msg = JSON.parse(raw)
      if (msg.setupComplete) {
        cb.onStatus?.('open')
        return
      }
      const sc = msg.serverContent
      if (!sc) return

      if (sc.inputTranscription?.text) origBuf += sc.inputTranscription.text
      if (sc.outputTranscription?.text) transBuf += sc.outputTranscription.text
      for (const p of sc.modelTurn?.parts ?? []) {
        if (p.inlineData?.data) cb.onAudio?.(fromB64(p.inlineData.data))
      }

      // 진행 중 갱신 또는 turn 종료 시 확정
      if (sc.inputTranscription || sc.outputTranscription || sc.turnComplete) {
        const final = !!sc.turnComplete
        cb.onTurn?.({ original: origBuf, translation: transBuf, final })
        if (final) {
          origBuf = ''
          transBuf = ''
        }
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
