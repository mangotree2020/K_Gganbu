// 푸시 알림 (PLANNING §11 FCM, REQ-NT-1) — @react-native-firebase/messaging 실 연동.
// 네이티브 모듈 미포함 빌드(구 dev build)에서는 require가 실패하므로 lazy require +
// mock 폴백으로 degrade — prebuild 재빌드 전에도 앱이 죽지 않는다.
// 권한은 just-in-time 요청(PLANNING 원칙) — opt-in 시점에만 호출한다.
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabase'

export type PushPermission = 'granted' | 'denied' | 'undetermined'

// messaging 모듈 lazy 로드 — 네이티브 미포함 빌드면 null
type MessagingModule = {
  requestPermission: () => Promise<number>
  getToken: () => Promise<string>
}
function getMessaging(): MessagingModule | null {
  try {
    // 정적 import 대신 lazy require — 네이티브 미포함 빌드에서 로드 실패를 흡수
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getMessaging: gm } = require('@react-native-firebase/messaging')
    return gm() as MessagingModule
  } catch {
    return null
  }
}

// 권한 요청 — iOS는 시스템 다이얼로그, Android 13+는 POST_NOTIFICATIONS
export async function requestPushPermission(): Promise<PushPermission> {
  const messaging = getMessaging()
  if (!messaging) return 'granted' // 네이티브 미포함 — mock 경로 유지
  try {
    // AuthorizationStatus: 0 denied / 1 authorized / 2 provisional
    const status = await messaging.requestPermission()
    return status === 0 ? 'denied' : 'granted'
  } catch {
    return 'denied'
  }
}

// 디바이스 FCM 토큰 획득
export async function getPushToken(): Promise<string | null> {
  const messaging = getMessaging()
  if (!messaging) return 'mock-fcm-token'
  try {
    return await messaging.getToken()
  } catch {
    return null
  }
}

// 토큰을 서버에 등록 — device_tokens upsert (user_id는 RLS 기본값, 토큰 unique)
export async function registerPushToken(token: string): Promise<boolean> {
  if (!token || token === 'mock-fcm-token') return token === 'mock-fcm-token'
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.user?.id) return false
    const { error } = await supabase
      .from('device_tokens')
      .upsert(
        { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
        { onConflict: 'token' },
      )
    return !error
  } catch {
    return false
  }
}

// opt-in 전체 플로우 — 권한 요청 → 토큰 획득 → 등록. 성공 여부 반환.
export async function enablePush(): Promise<boolean> {
  const perm = await requestPushPermission()
  if (perm !== 'granted') return false
  const token = await getPushToken()
  if (!token) return false
  return registerPushToken(token)
}
