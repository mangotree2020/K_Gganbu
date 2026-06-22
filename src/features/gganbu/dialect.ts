// 사투리(지역 방언) — GPS 위치 → 지역 → 사투리 매핑. 사투리 ON 시 AI가 해당 방언으로
// "친한 동네 친구"처럼 답하도록 지시문을 제공한다(서울·부산·제주·전라·충청·강원).
import * as Location from 'expo-location'
import type { Coords } from '@/hooks/useCurrentLocation'

export type DialectId =
  | 'standard'
  | 'gyeongsang'
  | 'jeju'
  | 'seoul'
  | 'jeolla'
  | 'chungcheong'
  | 'gangwon'

export type Dialect = {
  id: DialectId
  label: string // 버튼 표시용(예: 부산 사투리)
  instruction: string // AI 시스템 프롬프트에 주입할 방언 지시문(한국어)
}

export const DIALECTS: Record<DialectId, Dialect> = {
  standard: {
    id: 'standard',
    label: '표준어',
    instruction: '편한 반말 표준어로, 친한 친구처럼 다정하고 자연스럽게 답해줘.',
  },
  gyeongsang: {
    id: 'gyeongsang',
    label: '부산 사투리',
    instruction:
      '부산·경상도 사투리로, 친한 동네 친구처럼 반말로 답해줘. 정겹고 툭툭 던지는 말투로. ' +
      "어미 예: '~노', '~다 아이가', '~카더라', '~데이', '~가?', '~라카이'. 억양은 세지만 따뜻하게.",
  },
  jeju: {
    id: 'jeju',
    label: '제주 사투리',
    instruction:
      '제주 사투리로 친근하게 답해줘. 어미 예: "~수다", "~우꽈?", "혼저 옵서예", "~ㅎ주". ' +
      '너무 알아듣기 어려운 표현은 살짝 순화해서.',
  },
  seoul: {
    id: 'seoul',
    label: '서울말',
    instruction: '서울 토박이 친구처럼 편한 표준어 반말로, 트렌디하고 다정하게 답해줘.',
  },
  jeolla: {
    id: 'jeolla',
    label: '전라도 사투리',
    instruction:
      '전라도(광주) 사투리로, 정 많고 푸근한 친구처럼 답해줘. ' +
      "어미 예: '~잉', '~당께', '~제', '~구마', '거시기'. 따뜻하고 살갑게.",
  },
  chungcheong: {
    id: 'chungcheong',
    label: '충청도 사투리',
    instruction:
      '충청도 사투리로, 느긋하고 능청스러운 친구처럼 답해줘. ' +
      "어미 예: '~유', '~혀', '~겨?', '~봤슈', '~여'. 서두르지 않고 정겹게.",
  },
  gangwon: {
    id: 'gangwon',
    label: '강원도 사투리',
    instruction:
      '강원도 사투리로, 순박하고 정겨운 친구처럼 답해줘. ' +
      "어미 예: '~드래요', '~하야', '~예', '~잰?'. 꾸밈없이 따뜻하게.",
  },
}

// 지역 문자열(한/영) → 사투리 id. reverseGeocode region/subregion/city 텍스트로 판정.
export function matchDialect(text: string): DialectId {
  const s = (text ?? '').toLowerCase()
  if (/제주|jeju/.test(s)) return 'jeju'
  if (/부산|울산|경상|대구|busan|ulsan|gyeongsang|daegu/.test(s)) return 'gyeongsang'
  if (/광주|전라|전북|전남|gwangju|jeolla|jeonbuk|jeonnam/.test(s)) return 'jeolla'
  if (/대전|세종|충청|충남|충북|daejeon|sejong|chungcheong|chungnam|chungbuk/.test(s))
    return 'chungcheong'
  if (/강원|gangwon/.test(s)) return 'gangwon'
  if (/서울|경기|인천|seoul|gyeonggi|incheon/.test(s)) return 'seoul'
  return 'standard'
}

// GPS 좌표 → 사투리. 역지오코딩 실패 시 표준어.
export async function dialectFromCoords(coords: Coords): Promise<Dialect> {
  try {
    const a = (await Location.reverseGeocodeAsync(coords))[0]
    const text = [a?.region, a?.subregion, a?.city, a?.district, a?.name].filter(Boolean).join(' ')
    return DIALECTS[matchDialect(text)]
  } catch {
    return DIALECTS.standard
  }
}
