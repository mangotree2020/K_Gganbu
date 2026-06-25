// Gemini Live API 직결 클라이언트 (PLANNING §25 B안 — LiveKit/Agent 불필요)
// 기기 ↔ Gemini Live(BidiGenerateContent WS) 직접 연결. 키는 ephemeral 토큰으로 보호.
// 양방향 자동 통역: 외국인 발화→한국어, 한국어 발화→외국인 언어 (입력 언어 자동 감지).
// 오디오 캡처/재생(네이티브 PCM)은 호출측에서 sendAudio/onAudio 로 연결한다.
import { supabase } from '@/lib/supabase'

export type LiveStatus = 'connecting' | 'open' | 'closed' | 'error'

// 한 turn = 화자 원문 + 통역 결과 (대화형 말풍선용)
// audio: 통역 음성 24kHz PCM 전체(turn 확정 시) — 말풍선 '다시 듣기'용
// lang: Gemini가 감지한 소스 언어 코드(BCP-47, inputTranscription.languageCode). 없을 수 있음.
export type Turn = {
  original: string
  translation: string
  final: boolean
  audio?: Uint8Array
  lang?: string
}

export type LiveCallbacks = {
  onTurn?: (turn: Turn) => void
  // 24kHz PCM 통역 음성. sourceText: 현재 turn 원문, sourceLang: 감지 언어 코드(화자 판단용)
  onAudio?: (pcm24: Uint8Array, sourceText: string, sourceLang: string) => void
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
// 통역 음성 — Gemini Live prebuilt 음성. Aoede: 따뜻하고 자연스러운 톤("친절한 로컬 친구")
const VOICE_NAME = 'Aoede'

// PCM 청크들을 하나로 이어붙임 (turn 단위 음성 저장용)
function concatPcm(chunks: Uint8Array[]): Uint8Array {
  let len = 0
  for (const c of chunks) len += c.length
  const out = new Uint8Array(len)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

// 언어 코드 → 영어 이름(systemInstruction용)
const LANG_NAME: Record<string, string> = {
  en: 'English',
  ja: 'Japanese',
  'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  ko: 'Korean',
}

// 두 언어 간 양방향 통역 지시문. myLang(내 언어) ↔ peerLang(상대 언어).
// 내 언어 발화 → 상대 언어로, 상대 언어(또는 그 외 언어) 발화 → 내 언어로.
function interpreterInstruction(myLang: string, peerLang: string): string {
  const mine = LANG_NAME[myLang] ?? 'English'
  const peer = LANG_NAME[peerLang] ?? 'Korean'
  return (
    `You are a real-time interpreter for a face-to-face conversation between a ${mine} speaker and a ${peer} speaker. ` +
    `Detect the language of each utterance automatically, then apply this strict rule: ` +
    `an utterance spoken in ${mine} must be rendered in ${peer}; ` +
    `an utterance in ${peer} (or ANY other language) must be rendered in ${mine}. ` +
    `Your output language is therefore always ${mine} or ${peer} and nothing else, regardless of previous turns. ` +
    `Speak slowly, calmly, and very clearly, enunciating each word with natural pauses so a non-native listener can follow easily. ` +
    `Reply with ONLY the spoken translation — no notes, no language labels, no extra words.`
  )
}

type TokenGrant = { auth: string; isKey: boolean; wsHost: string; model: string }

async function getLiveToken(appLang: string): Promise<TokenGrant | null> {
  // 개발: 직접 키로 연결(?key=). 프로덕션: Supabase ephemeral 토큰(?access_token=).
  if (DEV_KEY) return { auth: DEV_KEY, isKey: true, wsHost: WS_HOST, model: MODEL }
  try {
    const { data, error } = await supabase.functions.invoke('gemini-live-token', {
      body: { appLang },
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
// mode: 'interpret'(기본) = 양방향 통역 + 음성 출력.
// 'transcribe' = 번역/음성 없이 발화 원문만 받음(STT — AI 깐부 음성 질문용).
export async function startLiveTranslate(
  opts: { appLang: string; peerLang?: string; mode?: 'interpret' | 'transcribe' },
  cb: LiveCallbacks,
): Promise<LiveSession | null> {
  const grant = await getLiveToken(opts.appLang)
  if (!grant) return null

  cb.onStatus?.('connecting')
  const apiVer = grant.isKey ? 'v1beta' : 'v1alpha'
  const authParam = grant.isKey ? `key=${grant.auth}` : `access_token=${grant.auth}`
  const url = `wss://${grant.wsHost}/ws/google.ai.generativelanguage.${apiVer}.GenerativeService.BidiGenerateContent?${authParam}`
  const ws = new WebSocket(url)
  ws.binaryType = 'arraybuffer'

  // 현재 turn 누적 버퍼 (원문/통역/음성/감지 언어)
  let origBuf = ''
  let transBuf = ''
  let langBuf = '' // Gemini 감지 소스 언어 코드(inputTranscription.languageCode)
  let audioChunks: Uint8Array[] = []

  ws.onopen = () => {
    // 전사(STT) 모드 — 번역/음성 출력 없이 입력 음성의 원문 텍스트만 받는다(AI 음성 질문용).
    const setup =
      opts.mode === 'transcribe'
        ? {
            // 이 Live 모델은 AUDIO 모달리티만 지원(TEXT 미지원) → AUDIO로 두되 침묵 지시 +
            // inputAudioTranscription으로 발화 원문만 사용한다(출력 음성은 호출측에서 무시).
            model: grant.model,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } },
            },
            systemInstruction: {
              parts: [
                {
                  text:
                    'You are a silent transcription engine. Always reply with just a single period ' +
                    'and never translate, answer, or add anything.',
                },
              ],
            },
            inputAudioTranscription: {},
          }
        : {
            // 세션 설정 — 양방향 통역(systemInstruction). AUDIO 출력 + 원문/통역 transcription.
            // speechConfig: 통역 음성을 자연스러운 prebuilt 음성(Aoede)으로 지정.
            model: grant.model,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } },
            },
            systemInstruction: {
              parts: [
                {
                  text: interpreterInstruction(
                    opts.appLang,
                    opts.peerLang ?? (opts.appLang === 'ko' ? 'en' : 'ko'),
                  ),
                },
              ],
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          }
    ws.send(JSON.stringify({ setup }))
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
      // 감지 언어 코드 — 청크마다 올 수 있어 비지 않은 최신값 유지
      if (sc.inputTranscription?.languageCode) langBuf = sc.inputTranscription.languageCode
      if (sc.outputTranscription?.text) transBuf += sc.outputTranscription.text
      for (const p of sc.modelTurn?.parts ?? []) {
        if (p.inlineData?.data) {
          const pcm = fromB64(p.inlineData.data)
          cb.onAudio?.(pcm, origBuf, langBuf) // 실시간 재생(원문·감지언어 함께 — 화자 판단)
          audioChunks.push(pcm) // turn 단위 누적(다시 듣기용)
        }
      }

      // 진행 중 갱신 또는 turn 종료 시 확정
      if (sc.inputTranscription || sc.outputTranscription || sc.turnComplete) {
        const final = !!sc.turnComplete
        cb.onTurn?.({
          original: origBuf,
          translation: transBuf,
          final,
          audio: final && audioChunks.length ? concatPcm(audioChunks) : undefined,
          lang: langBuf,
        })
        if (final) {
          origBuf = ''
          transBuf = ''
          langBuf = ''
          audioChunks = []
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
