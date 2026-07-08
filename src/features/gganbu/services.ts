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

export type GganbuReply = { reply: string; provider: 'claude' | 'mock' | 'cap' }

// 일일 사용량 상한(REQ-TR-3) 도달 안내 — 게스트는 로그인 시 한도 상향을 함께 안내
const CAP_MESSAGES: Record<string, string> = {
  en: "You've used all of today's free AI chats. Come back tomorrow — or log in for a higher daily limit.",
  ko: '오늘의 무료 AI 대화를 모두 사용했어요. 내일 다시 만나요 — 로그인하면 하루 한도가 늘어나요.',
  ja: '本日の無料AIチャットを使い切りました。また明日どうぞ。ログインすると1日の上限が増えます。',
  'zh-CN': '今天的免费AI对话已用完。明天再来吧——登录后每日上限更高。',
  'zh-TW': '今天的免費AI對話已用完。明天再來吧——登入後每日上限更高。',
}

const capMessage = (lang?: string) => CAP_MESSAGES[lang ?? 'en'] ?? CAP_MESSAGES.en

export async function askGganbu(
  messages: ChatMsg[],
  opts: {
    language?: string
    location?: string
    dialect?: string
    coords?: { lat: number; lng: number }
  } = {},
): Promise<GganbuReply> {
  try {
    const { data, error } = await supabase.functions.invoke('gganbu', {
      body: {
        messages,
        language: opts.language ?? 'en',
        location: opts.location,
        dialect: opts.dialect,
        coords: opts.coords,
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
// 서버 일일 상한 판정용으로 사용자 세션 토큰을 보낸다(게스트도 anonymous 세션 보유).
export async function askGganbuStream(
  messages: ChatMsg[],
  opts: {
    language?: string
    location?: string
    dialect?: string
    context?: string
    coords?: { lat: number; lng: number }
  },
  onDelta: (fullText: string) => void,
): Promise<GganbuReply> {
  const { data: sess } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
  const token = sess?.session?.access_token ?? ANON_KEY
  return new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${SUPABASE_URL}/functions/v1/gganbu`)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
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
        } else if (xhr.status === 429) {
          // 일일 상한 도달 — 사용자 언어로 안내(오프라인 배지 없음)
          resolve({ reply: capMessage(opts.language), provider: 'cap' })
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
          coords: opts.coords,
          stream: true,
        }),
      )
    } catch {
      resolve({ reply: mockReply(messages), provider: 'mock' })
    }
  })
}
