// 텍스트 음성 변환 — 앱 지정 언어로 메시지를 읽어준다(expo-speech, 플랫폼 TTS 엔진).
import * as Speech from 'expo-speech'

// 앱 언어 → TTS BCP-47 로케일
const TTS_LANG: Record<string, string> = {
  en: 'en-US',
  ko: 'ko-KR',
  ja: 'ja-JP',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
}

export function speakMessage(text: string, lang: string) {
  if (!text) return
  try {
    Speech.stop() // 이전 발화 중단 후 새 메시지
    Speech.speak(text, { language: TTS_LANG[lang] ?? 'en-US', rate: 0.98 })
  } catch {
    // TTS 미지원 환경 — 조용히 무시
  }
}

export function stopSpeak() {
  try {
    Speech.stop()
  } catch {
    // 무시
  }
}
