// AI 깐부 서비스 — gganbu Edge Function(Claude+RAG) 호출 + mock 폴백 (mock-first)
import { supabase } from '@/lib/supabase'

const SUPABASE_URL = process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? ''
const ANON_KEY = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? ''

export type ChatMsg = { role: 'user' | 'assistant'; text: string }

// 키 미설정/오류 시 폴백 mock 응답
const MOCK_REPLIES: Record<string, string> = {
  'Make my day plan':
    "You're in Haeundae, late morning — try: 11:00 Mipojeong gukbap, 12:30 Blueline Sky Capsule, 14:00 Bada View Cafe, 15:30 Gwangan Bridge stroll.",
  'Find foreigner-friendly food':
    'Halmae Gukbap (EN menu, halal-option), Slow Calm (vegetarian, 5-lang QR menu), Ediya 24h (accepts foreign cards).',
  'Help me read a menu':
    "Tap the camera button to OCR & translate a menu live — I'll flag allergens and spicy items.",
  "🆘 I'm stuck":
    'I can call 1330 (free 24/7 interpreter), translate for officials, or find your nearest embassy/hospital. What happened?',
}

function mockReply(messages: ChatMsg[]): string {
  const last = messages[messages.length - 1]?.text ?? ''
  return (
    MOCK_REPLIES[last] ??
    "Got it — I'll keep that in mind. Want me to find places, plan your time, or translate something?"
  )
}

export type GganbuReply = { reply: string; provider: 'claude' | 'mock' }

export async function askGganbu(
  messages: ChatMsg[],
  opts: { language?: string; location?: string; dialect?: string } = {},
): Promise<GganbuReply> {
  try {
    const { data, error } = await supabase.functions.invoke('gganbu', {
      body: {
        messages,
        language: opts.language ?? 'en',
        location: opts.location,
        dialect: opts.dialect,
      },
    })
    if (error) throw error
    if (data?.reply) return { reply: data.reply as string, provider: 'claude' }
    return { reply: mockReply(messages), provider: 'mock' }
  } catch {
    return { reply: mockReply(messages), provider: 'mock' }
  }
}

// 스트리밍 응답 — 토큰이 도착하는 즉시 onDelta(누적 텍스트)로 흘려준다(체감 즉시 응답).
// XHR onprogress로 누적 responseText를 읽음(RN fetch는 스트림 미지원). 실패 시 mock 폴백.
export function askGganbuStream(
  messages: ChatMsg[],
  opts: { language?: string; location?: string; dialect?: string; context?: string },
  onDelta: (fullText: string) => void,
): Promise<GganbuReply> {
  return new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${SUPABASE_URL}/functions/v1/gganbu`)
      xhr.setRequestHeader('Authorization', `Bearer ${ANON_KEY}`)
      xhr.setRequestHeader('apikey', ANON_KEY)
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.timeout = 25000
      let delivered = false
      xhr.onprogress = () => {
        const t = xhr.responseText
        // 평문 스트림만 처리(에러는 JSON으로 옴 → '{'로 시작하면 무시)
        if (t && !t.startsWith('{')) {
          delivered = true
          onDelta(t)
        }
      }
      xhr.onload = () => {
        const t = xhr.responseText ?? ''
        if (xhr.status === 200 && t.trim() && !t.startsWith('{')) {
          resolve({ reply: t, provider: 'claude' })
        } else {
          resolve({ reply: mockReply(messages), provider: 'mock' })
        }
      }
      const fail = () => resolve({ reply: mockReply(messages), provider: 'mock' })
      xhr.onerror = fail
      xhr.ontimeout = () => (delivered ? null : fail())
      xhr.send(
        JSON.stringify({
          messages,
          language: opts.language ?? 'en',
          location: opts.location,
          dialect: opts.dialect,
          context: opts.context,
          stream: true,
        }),
      )
    } catch {
      resolve({ reply: mockReply(messages), provider: 'mock' })
    }
  })
}
