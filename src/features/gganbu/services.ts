// AI 깐부 서비스 — gganbu Edge Function(Claude+RAG) 호출 + mock 폴백 (mock-first)
import { supabase } from '@/lib/supabase'

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

export async function askGganbu(
  messages: ChatMsg[],
  opts: { language?: string; location?: string } = {},
): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('gganbu', {
      body: { messages, language: opts.language ?? 'en', location: opts.location },
    })
    if (error) throw error
    if (data?.reply) return data.reply as string
    return mockReply(messages)
  } catch {
    return mockReply(messages)
  }
}
