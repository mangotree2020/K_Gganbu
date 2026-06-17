// 푸시 알림 (PLANNING §11 FCM) — mock-first 클라이언트 추상화.
// 실 전송은 @react-native-firebase/messaging(미설치) + Firebase FCM 프로젝트 설정 필요.
// 권한은 just-in-time 요청(PLANNING 원칙) — opt-in 시점에만 호출한다.
import { supabase } from '@/lib/supabase'

export type PushPermission = 'granted' | 'denied' | 'undetermined'

// 권한 요청 — 실 구현: messaging().requestPermission(). mock은 granted 반환.
export async function requestPushPermission(): Promise<PushPermission> {
  // TODO: @react-native-firebase/messaging 설치 후 실제 권한 요청으로 교체
  return 'granted'
}

// 디바이스 토큰 획득 — 실 구현: messaging().getToken(). mock은 결정적 토큰.
export async function getPushToken(): Promise<string | null> {
  // TODO: messaging().getToken()으로 교체
  return 'mock-fcm-token'
}

// 토큰을 서버에 등록(본인 프로필 기준) — device_tokens 테이블/Edge Function 연동.
// 미설정 시 조용히 무시(opt-in UX는 로컬 상태로 유지).
export async function registerPushToken(token: string): Promise<boolean> {
  if (!token) return false
  try {
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user?.id
    if (!userId) return false
    // TODO: device_tokens upsert (user_id, token, platform) — 테이블 추가 후 활성화
    return true
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
