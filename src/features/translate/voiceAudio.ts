// 음성통역 네이티브 오디오 I/O (PLANNING §25 B안) — react-native-audio-api 기반.
// 마이크 16kHz PCM 캡처 → Gemini Live 송신용 Int16, 24kHz PCM 수신 → 재생 큐.
import { AudioContext, AudioManager, AudioRecorder } from 'react-native-audio-api'

// 출력 장치가 이어폰/헤드셋인지 — type/name에 head/bluetooth/airpod 등 포함 여부.
// (런타임 객체는 type 필드를 쓴다 — 예: 'Bluetooth A2DP', 'Wired Headset', 'Built-in Speaker')
// 이어폰이면 스피커→마이크 에코 누설이 없어 에너지 게이트가 불필요(완전 동시 발화 가능).
function looksLikeHeadset(d: { category?: string; name?: string; type?: string }): boolean {
  const s = `${d.type ?? ''} ${d.category ?? ''} ${d.name ?? ''}`.toLowerCase()
  return /head|bluetooth|airpod|earbud|earphone|a2dp|usb/.test(s)
}

// 현재 출력이 이어폰/헤드셋에 연결되어 있는지
export async function isHeadsetConnected(): Promise<boolean> {
  try {
    const info = await AudioManager.getDevicesInfo()
    // Android에서 currentOutputs가 비어있는 경우가 있어 availableOutputs로 폴백.
    // availableOutputs는 현재 연결된 출력만 반환하므로 헤드셋류가 있으면 연결된 것.
    const list = info.currentOutputs.length ? info.currentOutputs : info.availableOutputs
    return list.some(looksLikeHeadset)
  } catch {
    return false
  }
}

// 오디오 라우팅 변경(이어폰 연결/해제) 구독
export function observeRouteChange(cb: () => void): { remove: () => void } {
  const sub = AudioManager.addSystemEventListener('routeChange', () => cb())
  return { remove: () => sub?.remove() }
}

// Float32[-1,1] → Int16 LE bytes
function floatToPcm16(f32: Float32Array): Uint8Array {
  const out = new Uint8Array(f32.length * 2)
  const view = new DataView(out.buffer)
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return out
}

// Int16 LE bytes → Float32
function pcm16ToFloat(bytes: Uint8Array): Float32Array {
  const n = Math.floor(bytes.byteLength / 2)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = view.getInt16(i * 2, true) / 0x8000
  return out
}

// Int16 PCM의 RMS(0~1) — 입력 음량 추정(동시 발화용 에너지 게이트)
export function rms16(bytes: Uint8Array): number {
  const n = Math.floor(bytes.byteLength / 2)
  if (n === 0) return 0
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let sum = 0
  for (let i = 0; i < n; i++) {
    const s = view.getInt16(i * 2, true) / 0x8000
    sum += s * s
  }
  return Math.sqrt(sum / n)
}

export type MicHandle = { stop: () => void }

// 마이크 캡처 시작 — 16kHz mono PCM16 청크를 콜백으로 전달
export function startMic(onPcm16: (bytes: Uint8Array) => void): MicHandle {
  const rec = new AudioRecorder()
  rec.onAudioReady({ sampleRate: 16000, bufferLength: 1600, channelCount: 1 }, (e) => {
    try {
      onPcm16(floatToPcm16(e.buffer.getChannelData(0)))
    } catch {
      // 변환 실패 청크 무시
    }
  })
  rec.start()
  return {
    stop: () => {
      try {
        rec.stop()
      } catch {
        // 무시
      }
      try {
        rec.clearOnAudioReady()
      } catch {
        // 무시
      }
    },
  }
}

export type Player = {
  play: (pcm16: Uint8Array) => void // 스트리밍 재생(시간순 큐)
  playNow: (pcm16: Uint8Array) => void // 즉시 재생(다시 듣기)
  setVolume: (v: number) => void // 0~1 볼륨
  isPlaying: () => boolean // 통역 음성 재생 중 여부(에코 억제용 마이크 게이팅)
  primeSilence: (sec: number) => void // 무음을 재생해 오디오 경로 wake-up + 다음 재생 지연
  close: () => void
}

// 재생 종료 후 잔향·스피커→마이크 지연을 고려한 여유 시간(초)
const ECHO_GUARD_SEC = 0.25

// 24kHz PCM16 스트림 재생 — 버퍼를 시간순으로 이어붙여 끊김 없이 출력.
// 볼륨은 샘플 진폭에 직접 곱해 적용(GainNode 비의존 — 어느 환경에서나 동작).
export function createPlayer(sampleRate = 24000, volume = 1): Player {
  // 컨텍스트 샘플레이트를 입력(24kHz)과 일치시킴. 기기 기본(보통 48kHz)으로 두면
  // 24kHz 버퍼가 ~2배 빠르게 재생되어 음성이 빠르고 부자연스러워짐(기기 로그로 48kHz→24kHz 확인).
  const ctx = new AudioContext({ sampleRate })
  let nextTime = 0 // ctx 스케줄용(src.start 예약 시각)
  let queueEndMs = 0 // 재생 큐 종료 예정(epoch ms) — 게이팅 판단용(ctx.currentTime 비의존)
  let vol = volume
  const render = (pcm16: Uint8Array, immediate: boolean) => {
    const f = pcm16ToFloat(pcm16)
    if (f.length === 0) return
    if (vol !== 1) for (let i = 0; i < f.length; i++) f[i] *= vol
    const buf = ctx.createBuffer(1, f.length, sampleRate)
    buf.copyToChannel(f, 0)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    const t = immediate ? ctx.currentTime : Math.max(ctx.currentTime, nextTime)
    src.start(t)
    nextTime = Math.max(nextTime, t + buf.duration)
    // 게이팅용 종료 시각은 Date 기반으로 추적 — ctx.currentTime이 신뢰 불가한 환경 대비
    const now = Date.now()
    const startMs = immediate ? now : Math.max(now, queueEndMs)
    queueEndMs = startMs + buf.duration * 1000
  }
  return {
    play: (pcm16) => render(pcm16, false),
    playNow: (pcm16) => render(pcm16, true),
    setVolume: (v) => {
      vol = Math.max(0, Math.min(1, v))
    },
    isPlaying: () => Date.now() < queueEndMs + ECHO_GUARD_SEC * 1000,
    // 무음 버퍼를 실제로 큐에 재생 — 블루투스 A2DP 등 idle 상태의 출력 경로를 미리
    // 깨워 첫 통역 음성의 앞부분 잘림을 방지(무음이 잘려도 실제 음성은 보존). render가
    // nextTime/queueEndMs를 무음 길이만큼 밀어 다음 실제 재생도 그 뒤에 이어진다.
    primeSilence: (sec) => {
      const len = Math.floor(sampleRate * sec)
      if (len > 0) render(new Uint8Array(len * 2), false)
    },
    close: () => {
      ctx.close().catch(() => {})
    },
  }
}
