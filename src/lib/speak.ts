// 텍스트 음성 변환 — 앱 지정 언어로 메시지를 읽어준다(expo-speech, 플랫폼 TTS 엔진).
import * as Speech from 'expo-speech'

import { INTERPRET_LANGS } from '@/features/translate/langs'

// 언어 코드 → TTS BCP-47 로케일 (통역 지원 언어 단일 소스에서)
// 주: 로케일 실제 지원 여부는 기기 TTS 엔진에 달렸다. 미설치 언어는 무음일 수 있어
// 호출측은 onDone 콜백으로만 흐름을 이어간다(발화 성공을 전제하지 않음).
const TTS_LANG: Record<string, string> = Object.fromEntries(
  INTERPRET_LANGS.map((l) => [l.code, l.ttsLocale]),
)

export type SpeakOpts = { rate?: number; pitch?: number; onDone?: () => void }

// onDone: 발화 종료(완료/중단/오류) 콜백 — 음성 입력 중 에코 게이팅 해제 등에 사용.
// rate/pitch: 친구처럼 자연스러운 톤 조절(기본은 약간 느긋·살짝 높은 피치).
export function speakMessage(text: string, lang: string, opts: SpeakOpts | (() => void) = {}) {
  const o = typeof opts === 'function' ? { onDone: opts } : opts
  const onDone = o.onDone
  if (!text) {
    onDone?.()
    return
  }
  try {
    Speech.stop() // 이전 발화 중단 후 새 메시지
    Speech.speak(text, {
      language: TTS_LANG[lang] ?? 'en-US',
      rate: o.rate ?? 0.96,
      pitch: o.pitch ?? 1.05,
      onDone,
      onStopped: onDone,
      onError: onDone,
    })
  } catch {
    // TTS 미지원 환경 — 조용히 무시
    onDone?.()
  }
}

export function stopSpeak() {
  try {
    Speech.stop()
  } catch {
    // 무시
  }
}
