// gganbu — AI 깐부 챗봇 Edge Function (Claude API + TourAPI RAG)
// PLANNING §18 페르소나·가드레일. 키 미설정 시 502(클라이언트 mock 폴백).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Msg = { role: 'user' | 'assistant'; text: string }
type Body = {
  messages: Msg[]
  language?: string
  location?: string
  dialect?: string
  context?: string // 실시간 컨텍스트(날씨·주변 장소·통역 이력) — 정확한 답변용
  stream?: boolean
}

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
    // RAG는 부가 컨텍스트일 뿐 — 속도 우선이므로 0.8s 타임아웃(느리면 건너뛰고 바로 응답)
    const res = await fetch(`https://apis.data.go.kr/B551011/${service}/areaBasedList2?${params}`, {
      signal: AbortSignal.timeout(800),
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

function systemPrompt(
  language: string,
  location: string,
  rag: string,
  dialect?: string,
  context?: string,
) {
  // 사투리 모드: 해당 방언으로(한국어) 동네 친구처럼. 표준 언어 지시보다 우선.
  const langLine = dialect
    ? `IMPORTANT: Reply ENTIRELY in Korean using this regional dialect — ${dialect} ` +
      `Speak casually like a close local friend (반말), keep it warm and natural. Current area: ${location}.`
    : `Reply in the user's language (code: ${language}). Current area: ${location}.`
  return [
    'You are "K-Gganbu" (깐부) — a cheerful, friendly local Busan best friend helping an inbound foreign traveler.',
    'Persona: warm and casual like a local friend, NOT an encyclopedia.',
    'BE FAST AND BRIEF: reply in just 1-3 short sentences, get to the point immediately. No preamble, no long lists.',
    langLine,
    'Write in plain conversational sentences (no markdown headers, no bullet lists) so it sounds natural when read aloud.',
    'Recommend real places, food, and routes; suggest cards the app can link to map/coupons.',
    // 실시간 컨텍스트 — 날씨/주변 장소/사용자가 통역한 내용. 정확한 답변에 적극 활용.
    context
      ? `LIVE CONTEXT (use these real facts for accurate answers about weather, nearby places, and the traveler's needs): ${context}`
      : '',
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

    const {
      messages,
      language = 'en',
      location = 'Haeundae, Busan',
      dialect,
      context,
      stream = false,
    }: Body = await req.json()
    if (!messages?.length) {
      return new Response(JSON.stringify({ error: 'messages 필수' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 속도 우선 — RAG(TourAPI) 대기를 기본 비활성화(즉시 응답). 필요 시 ?rag=1 로 켬.
    // (ragContext는 보존 — 추후 품질 모드에서 재사용)
    const useRag = new URL(req.url).searchParams.get('rag') === '1'
    const rag = useRag ? await ragContext(dialect ? 'ko' : language) : ''

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        // 속도 우선 — Haiku(가장 빠른 모델) + 짧은 max_tokens로 즉시 응답
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        stream, // 스트리밍 요청 시 토큰 단위로 흘려보냄(체감 즉시 응답)
        system: systemPrompt(language, location, rag, dialect, context),
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

    // 스트리밍 — Anthropic SSE에서 text_delta만 뽑아 평문으로 흘려보냄(클라이언트는 누적 텍스트만 읽음)
    if (stream && res.body) {
      const out = new ReadableStream({
        async start(controller) {
          const reader = res.body!.getReader()
          const decoder = new TextDecoder()
          const encoder = new TextEncoder()
          let buf = ''
          try {
            for (;;) {
              const { done, value } = await reader.read()
              if (done) break
              buf += decoder.decode(value, { stream: true })
              const lines = buf.split('\n')
              buf = lines.pop() ?? ''
              for (const line of lines) {
                const s = line.trim()
                if (!s.startsWith('data:')) continue
                try {
                  const ev = JSON.parse(s.slice(5).trim())
                  if (ev.type === 'content_block_delta' && ev.delta?.text) {
                    controller.enqueue(encoder.encode(ev.delta.text))
                  }
                } catch {
                  // SSE 비JSON 라인 무시
                }
              }
            }
          } catch {
            // 스트림 중단 — 클라이언트가 받은 만큼 사용
          }
          controller.close()
        },
      })
      return new Response(out, {
        headers: {
          ...cors,
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      })
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
