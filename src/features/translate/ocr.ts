// 카메라 OCR 서비스 — Edge Function(Google Vision) 호출 + mock 폴백 (mock-first)
import { supabase } from '@/lib/supabase'

export type OcrResult = { text: string; provider: 'edge' | 'mock' }

// 키 미설정/네트워크 실패 시 폴백용 샘플 (메뉴판 OCR 데모)
const MOCK_TEXT = ['김치찌개  8,000', '제육볶음  9,000', '된장찌개  7,500', '공기밥  1,000'].join(
  '\n',
)

export async function detectText(base64Image: string): Promise<OcrResult> {
  try {
    const { data, error } = await supabase.functions.invoke('ocr', {
      body: { image: base64Image },
    })
    if (error) throw error
    if (typeof data?.text === 'string' && data.text.trim()) {
      return { text: data.text, provider: 'edge' }
    }
    // no_key/빈 결과 → 폴백
    return { text: MOCK_TEXT, provider: 'mock' }
  } catch {
    return { text: MOCK_TEXT, provider: 'mock' }
  }
}
