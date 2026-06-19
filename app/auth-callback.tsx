import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'

import { useAuthStore } from '@/features/auth/store'
import { palette } from '@/theme/tokens'

// OAuth 콜백 딥링크(travel-app://auth-callback) 착지 화면.
// openAuthSessionAsync가 콜백을 가로채 세션을 설정하는 동안, 앱 스킴이 OS 딥링크로도
// 잡혀 이 라우트로 진입한다. 전용 라우트가 없으면 expo-router의 "Unmatched Route"(404)가
// 잠깐 노출되므로, 404 대신 로딩만 보여주고 인증이 확정되면 본화면으로 보낸다.
export default function AuthCallback() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  // 세션 설정이 끝나 인증되면 즉시 본화면으로(콜백 처리 중에는 스피너만)
  if (isAuthenticated) return <Redirect href="/(tabs)" />
  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color={palette.teal[40]} />
    </View>
  )
}
