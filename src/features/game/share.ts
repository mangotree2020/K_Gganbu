// 게임 결과 공유 (PRD REQ-GM-4) — SNS 바이럴 + 설치 유입.
// 링크는 QR 랜딩과 같은 계측 리다이렉터를 쓴다: ch 파라미터가 landing_events 에 남아
// "게임 공유로 몇 명이 설치했는가"를 채널별로 볼 수 있다(REQ-CR-4 인프라 재사용).
//
// IP 가드레일(REQ-GM-3): 공유 문구에도 Netflix 드라마 IP 요소(명칭·비주얼·상징물)를 쓰지 않는다.
// 브랜딩은 'K-Traditional Games'. 금칙어는 `ipGuard.test.ts` 가 자동 검사한다.
import { Share } from 'react-native'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''

export const shareLink = (channel: string) =>
  SUPABASE_URL
    ? `${SUPABASE_URL}/functions/v1/landing?ch=${encodeURIComponent(channel)}`
    : 'https://play.google.com/store/apps/details?id=com.mangonw.gganbu'

export async function shareGameResult(
  gameName: string,
  score: number,
  t: (k: string) => string,
): Promise<void> {
  const message = `${t('game.shareText')
    .replace('{game}', gameName)
    .replace('{score}', String(score))}\n${shareLink('game_share')}`
  try {
    await Share.share({ message })
  } catch {
    // 사용자가 공유 시트를 닫은 경우 등 — 무시
  }
}
