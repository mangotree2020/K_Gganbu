// 번역 서비스 — Edge Function(Google Cloud Translation) 호출 + mock 폴백 (mock-first)
// 서비스 레이어 패턴 예시 (BACKLOG #3): USE_MOCK 토글 + withRetry 네트워크 재시도.
import { USE_MOCK } from '@/lib/config'
import { supabase } from '@/lib/supabase'
import { withRetry } from '@/lib/withRetry'

export type TranslateInput = { source?: string; target: string; text: string }
export type TranslateResult = { translatedText: string; provider: string }

// 오프라인/키 미설정 폴백용 mock 사전
const MOCK: Record<string, string> = {
  'Does this dish contain pork?': '이 음식에 돼지고기가 들어가나요?',
  'Can I have the bill, please?': '계산서 좀 주시겠어요?',
  'Where is the nearest subway?': '가장 가까운 지하철역이 어디에 있나요?',
  'How much is this?': '이거 얼마예요?',
  "I'm allergic to peanuts.": '저는 땅콩 알레르기가 있어요.',
}

function mockTranslate({ source, text }: TranslateInput): TranslateResult {
  const hit = MOCK[text.trim()]
  if (hit) return { translatedText: hit, provider: 'mock' }
  const src = source ?? (/[가-힣]/.test(text) ? 'ko' : 'en')
  return { translatedText: `${src === 'ko' ? '[EN] ' : '[KO] '}${text}`, provider: 'mock' }
}

export async function translateText(input: TranslateInput): Promise<TranslateResult> {
  // 플래그가 켜지면 외부 호출 없이 mock (오프라인 데모/테스트)
  if (USE_MOCK) return mockTranslate(input)
  try {
    const { data } = await withRetry(async () => {
      const res = await supabase.functions.invoke('translate', { body: input })
      if (res.error) throw res.error
      return res
    })
    if (data?.translatedText) {
      return { translatedText: data.translatedText, provider: data.provider ?? 'edge' }
    }
    // no_provider 등 → 폴백
    return mockTranslate(input)
  } catch {
    // 네트워크 실패/함수 오류 → 폴백 (친절 degrade)
    return mockTranslate(input)
  }
}
