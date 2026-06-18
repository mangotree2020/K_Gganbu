// 음성통역 네이티브 오디오 I/O (PLANNING §25 B안) — react-native-audio-api 기반.
// 마이크 16kHz PCM 캡처 → Gemini Live 송신용 Int16, 24kHz PCM 수신 → 재생 큐.
import { AudioContext, AudioRecorder } from 'react-native-audio-api'

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
  close: () => void
}

// 24kHz PCM16 스트림 재생 — 버퍼를 시간순으로 이어붙여 끊김 없이 출력.
// 볼륨은 샘플 진폭에 직접 곱해 적용(GainNode 비의존 — 어느 환경에서나 동작).
export function createPlayer(sampleRate = 24000, volume = 1): Player {
  const ctx = new AudioContext()
  let nextTime = 0
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
    if (!immediate) nextTime = t + buf.duration
  }
  return {
    play: (pcm16) => render(pcm16, false),
    playNow: (pcm16) => render(pcm16, true),
    setVolume: (v) => {
      vol = Math.max(0, Math.min(1, v))
    },
    close: () => {
      ctx.close().catch(() => {})
    },
  }
}
