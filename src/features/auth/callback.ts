// OAuth 콜백 URL → 세션 토큰 추출 (순수 함수, 단위 테스트 대상).
// provider/플로우에 따라 토큰이 fragment(#) 또는 query(?)로 오므로 둘 다 처리한다.
// 토큰이 없고 error/error_description이 있으면 사용자에게 그 사유를 노출한다.
export type AuthTokens = { access_token: string; refresh_token: string }

export function parseAuthCallback(callbackUrl: string): AuthTokens {
  const url = new URL(callbackUrl)
  const fromHash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const fromQuery = url.searchParams
  const pick = (key: string) => fromHash.get(key) ?? fromQuery.get(key)

  const access_token = pick('access_token')
  const refresh_token = pick('refresh_token')
  if (!access_token || !refresh_token) {
    const reason = pick('error_description') ?? pick('error')
    throw new Error(reason ? `OAuth 콜백 오류: ${reason}` : '세션 토큰을 받지 못했습니다')
  }
  return { access_token, refresh_token }
}
