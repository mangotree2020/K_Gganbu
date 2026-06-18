// 출력 라우팅 전환 네이티브 모듈 — 이어폰 중 내 발화 통역만 스피커로.
import { requireNativeModule } from 'expo-modules-core'

type SpeakerRouteNative = {
  setSpeaker: (on: boolean) => boolean
  reset: () => void
}

let native: SpeakerRouteNative | null = null
try {
  native = requireNativeModule<SpeakerRouteNative>('SpeakerRoute')
} catch {
  native = null // Expo Go 등 네이티브 미탑재 환경
}

// 스피커 강제(on=true)/해제(false). 네이티브 없으면 false 반환.
export function setSpeaker(on: boolean): boolean {
  try {
    return native?.setSpeaker(on) ?? false
  } catch {
    return false
  }
}

export function resetSpeaker(): void {
  try {
    native?.reset()
  } catch {
    // 무시
  }
}

export const speakerRouteAvailable = native != null
