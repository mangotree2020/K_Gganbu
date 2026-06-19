import { parseAuthCallback } from './callback'

describe('parseAuthCallback', () => {
  it('fragment(#)로 온 토큰을 추출한다', () => {
    const url =
      'travel-app://auth-callback#access_token=AAA&refresh_token=BBB&expires_in=3600&token_type=bearer'
    expect(parseAuthCallback(url)).toEqual({ access_token: 'AAA', refresh_token: 'BBB' })
  })

  it('query(?)로 온 토큰도 추출한다(PKCE/대체 플로우)', () => {
    const url = 'travel-app://auth-callback?access_token=QQ&refresh_token=RR'
    expect(parseAuthCallback(url)).toEqual({ access_token: 'QQ', refresh_token: 'RR' })
  })

  it('fragment를 query보다 우선한다', () => {
    const url =
      'travel-app://auth-callback?access_token=Q&refresh_token=Q#access_token=H&refresh_token=H'
    expect(parseAuthCallback(url)).toEqual({ access_token: 'H', refresh_token: 'H' })
  })

  it('토큰이 없으면 기본 에러를 던진다', () => {
    expect(() => parseAuthCallback('travel-app://auth-callback')).toThrow(
      '세션 토큰을 받지 못했습니다',
    )
  })

  it('access_token만 있고 refresh_token이 없으면 에러', () => {
    expect(() => parseAuthCallback('travel-app://auth-callback#access_token=AAA')).toThrow(
      '세션 토큰을 받지 못했습니다',
    )
  })

  it('error_description이 있으면 그 사유를 노출한다(사용자 취소 등)', () => {
    const url = 'travel-app://auth-callback#error=access_denied&error_description=User%20cancelled'
    expect(() => parseAuthCallback(url)).toThrow('OAuth 콜백 오류: User cancelled')
  })

  it('error_description이 없고 error만 있으면 error 코드를 노출한다', () => {
    const url = 'travel-app://auth-callback?error=server_error'
    expect(() => parseAuthCallback(url)).toThrow('OAuth 콜백 오류: server_error')
  })
})
