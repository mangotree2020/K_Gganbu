// gganbu — AI 깐부 챗봇 Edge Function (Claude API + TourAPI RAG)
// PLANNING §18 페르소나·가드레일. 키 미설정 시 502(클라이언트 mock 폴백).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Msg = { role: 'user' | 'assistant'; text: string }
type Body = { messages: Msg[]; language?: string; location?: string }

const SERVICE: Record<string, string> = {
  ko: 'KorService2',
  en: 'EngService2',
  ja: 'JpnService2',
  'zh-CN': 'ChsService2',
  'zh-TW': 'ChtService2',
}

// TourAPI 부산 POI 몇 건을 RAG 컨텍스트로 (1차)
async function ragContext(language: string): Promise<string> {
  const key = Deno.env.get('TOUR_API_KEY')
  if (!key) return ''
  try {
    const service = SERVICE[language] ?? SERVICE.en
    const params = new URLSearchParams({
      serviceKey: decodeURIComponent(key),
      areaCode: '6',
      numOfRows: '8',
      pageNo: '1',
      MobileOS: 'ETC',
      MobileApp: 'KGganbu',
      _type: 'json',
      arrange: 'O',
    })
    // RAG는 부가 컨텍스트일 뿐 — 느리면 응답을 막지 않도록 2.5s 타임아웃
    const res = await fetch(`https://apis.data.go.kr/B551011/${service}/areaBasedList2?${params}`, {
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return ''
    const json = await res.json()
    const items = json?.response?.body?.items?.item ?? []
    const list = (Array.isArray(items) ? items : [items])
      .map((it: Record<string, string>) => `- ${it.title} (${it.addr1 ?? ''})`)
      .join('\n')
    return list ? `\n\nNearby Busan places (live TourAPI data):\n${list}` : ''
  } catch {
    return ''
  }
}

function systemPrompt(language: string, location: string, rag: string) {
  return [
    'You are "K-Gganbu" (깐부) — a cheerful, friendly local Busan best friend helping an inbound foreign traveler.',
    'Persona: warm and casual like a local friend, NOT an encyclopedia. Keep replies short and practical.',
    `Reply in the user's language (code: ${language}). Current area: ${location}.`,
    'Recommend real places, food, and routes; suggest cards the app can link to map/coupons.',
    'GUARDRAILS: For medical, legal, or visa matters, do NOT give definitive answers — direct to official help (1330 tourist hotline, 112 police, 119 ambulance, embassy).',
    'If the user mentions an emergency (lost wallet/passport, sick, lost), immediately suggest the SOS flow and 1330.',
    rag,
  ].join('\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'no_key', message: 'ANTHROPIC_API_KEY 미설정' }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    const { messages, language = 'en', location = 'Haeundae, Busan' }: Body = await req.json()
    if (!messages?.length) {
      return new Response(JSON.stringify({ error: 'messages 필수' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const rag = await ragContext(language)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: systemPrompt(language, location, rag),
        messages: messages.map((m) => ({ role: m.role, content: m.text })),
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return new Response(
        JSON.stringify({ error: 'anthropic_error', status: res.status, detail: err.slice(0, 200) }),
        {
          status: 502,
          headers: { ...cors, 'Content-Type': 'application/json' },
        },
      )
    }

    const json = await res.json()
    // refusal 등 처리
    if (json.stop_reason === 'refusal') {
      return new Response(
        JSON.stringify({
          reply: '미안해요, 그 요청은 도와주기 어려워요. 1330 관광통역 안내로 연결해 드릴까요?',
        }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }
    const reply = (json.content ?? []).find((b: { type: string }) => b.type === 'text')?.text ?? ''

    // 빈 응답 방어 — 클라이언트 mock 폴백을 타도록 502 반환
    if (!reply.trim()) {
      return new Response(JSON.stringify({ error: 'empty_reply' }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
