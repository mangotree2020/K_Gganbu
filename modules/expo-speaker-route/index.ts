// 출력 라우팅 전환 네이티브 모듈 — 이어폰 중 내 발화 통역만 스피커로.
// onRouteChanged 이벤트로 출력 전환 완료를 알려 JS가 재생 타이밍을 맞춘다.
import { requireNativeModule, type EventSubscription } from 'expo-modules-core'

type SpeakerRouteNative = {
  setSpeaker: (on: boolean) => boolean
  reset: () => void
  addListener: (name: string, cb: (payload: unknown) => void) => EventSubscription
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

// 출력 전환 완료 이벤트 구독 — 라우팅이 실제로 바뀐 시점에 콜백.
export function addRouteChangedListener(cb: () => void): { remove: () => void } {
  try {
    const sub = native?.addListener('onRouteChanged', () => cb())
    return { remove: () => sub?.remove() }
  } catch {
    return { remove: () => {} }
  }
}

export const speakerRouteAvailable = native != null
