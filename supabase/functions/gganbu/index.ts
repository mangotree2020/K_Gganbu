// gganbu — AI 깐부 챗봇 Edge Function (Gemini 2.5 Flash-Lite 주력 + Claude 폴백, TourAPI RAG)
// PLANNING §18 페르소나·가드레일. 모델 전략(2026-07 가성비 검토):
//   주력 = Gemini 2.5 Flash-Lite($0.10/$0.40 per 1M — 여행 FAQ·장소 안내에 최적 가성비)
//   폴백 = Claude(기존 티어링) — Gemini 키 미설정/오류 시 품질 백업
// 키 모두 미설정 시 502(클라이언트 mock 폴백).
// 일일 사용량 상한(REQ-TR-3, BM§3.3): 게스트/로그인 사용자별 KST 일 단위 카운팅.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

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
  coords?: { lat: number; lng: number } // 실데이터(Google/Naver) 조회 기준 좌표
  stream?: boolean
}

// 모델 티어링 (PRD REQ-AI-4, BM§3.3) — 단순 질의는 Haiku(저비용·즉답),
// 복잡 질의(일정/코스 생성·장문·긴 대화)는 Sonnet으로 품질 확보.
const COMPLEX_HINT =
  /일정|계획|코스|스케줄|짜\s?줘|plan|itinerar|schedule|route|course|day.?trip|プラン|日程|行程|规划|規劃|안내해\s?줘/i
function pickModel(messages: Msg[]): { model: string; maxTokens: number } {
  const last = messages[messages.length - 1]?.text ?? ''
  const complex = last.length > 200 || COMPLEX_HINT.test(last) || messages.length > 8
  return complex
    ? { model: 'claude-sonnet-5', maxTokens: 768 }
    : { model: 'claude-haiku-4-5-20251001', maxTokens: 512 }
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

// Google Places(평점·영업 중 여부) + Naver 지역검색(로컬 상호·카테고리) 실데이터 —
// 답변 품질용 부가 컨텍스트. 속도 우선이라 병렬 0.9s 타임아웃, 실패 시 조용히 생략.
async function livePlaceData(
  coords: { lat: number; lng: number } | undefined,
  location: string,
  lang: string,
): Promise<string> {
  const tasks: Promise<string>[] = []

  const gkey = Deno.env.get('GOOGLE_PLACES_API_KEY')
  if (gkey && coords) {
    tasks.push(
      fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
          `?location=${coords.lat},${coords.lng}&radius=800&language=${lang}&key=${gkey}`,
        { signal: AbortSignal.timeout(900) },
      )
        .then((r) => r.json())
        .then((d) => {
          const rows = (d.results ?? [])
            .filter((x: any) => x.rating)
            .slice(0, 8)
            .map((x: any) => {
              const open =
                x.opening_hours?.open_now === true
                  ? 'open now'
                  : x.opening_hours?.open_now === false
                    ? 'closed now'
                    : ''
              return `- ${x.name} (rating ${x.rating}/5, ${x.user_ratings_total ?? 0} reviews${open ? ', ' + open : ''})`
            })
            .join('\n')
          return rows ? `Nearby places with live Google Maps data:\n${rows}` : ''
        })
        .catch(() => ''),
    )
  }

  // Naver 지역검색 — 현지인 기준 상호·카테고리(로컬 정확도 보완). 지역명 + 맛집 키워드.
  const nid = Deno.env.get('NAVER_SEARCH_CLIENT_ID') ?? Deno.env.get('NAVER_CLIENT_ID')
  const nsec = Deno.env.get('NAVER_SEARCH_CLIENT_SECRET') ?? Deno.env.get('NAVER_CLIENT_SECRET')
  if (nid && nsec) {
    const q = `${location.split(',')[0]} 맛집`
    tasks.push(
      fetch(
        `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(q)}&display=5&sort=random`,
        {
          headers: { 'X-Naver-Client-Id': nid, 'X-Naver-Client-Secret': nsec },
          signal: AbortSignal.timeout(900),
        },
      )
        .then((r) => r.json())
        .then((d) => {
          const rows = (d.items ?? [])
            .map(
              (x: any) =>
                `- ${String(x.title).replace(/<[^>]+>/g, '')} (${x.category ?? ''}, ${x.roadAddress ?? ''})`,
            )
            .join('\n')
          return rows ? `Local favorites from live Naver Map data:\n${rows}` : ''
        })
        .catch(() => ''),
    )
  }

  if (!tasks.length) return ''
  const parts = (await Promise.all(tasks)).filter(Boolean)
  return parts.length ? `\n\n${parts.join('\n\n')}` : ''
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
    'When live place data is provided below, prefer those REAL places (with their ratings/open status) over memory. For exact opening hours or real-time status, remind the traveler they can tap the place to check it live on the in-app Map tab.',
    // 실시간 컨텍스트 — 날씨/주변 장소/사용자가 통역한 내용. 정확한 답변에 적극 활용.
    context
      ? `LIVE CONTEXT (use these real facts for accurate answers about weather, nearby places, and the traveler's needs): ${context}`
      : '',
    'GUARDRAILS: For medical, legal, or visa matters, do NOT give definitive answers — direct to official help (1330 tourist hotline, 112 police, 119 ambulance, embassy).',
    'If the user mentions an emergency (lost wallet/passport, sick, lost), immediately suggest the SOS flow and 1330.',
    rag,
  ].join('\n')
}

// 일일 사용량 상한 — 게스트(anonymous) 20회 / 로그인 200회 (env로 조정 가능).
// bump_usage RPC가 원자적 증가 후 카운트를 반환하므로 경쟁 요청으로 우회 불가.
// 카운터 인프라 오류 시에는 차단하지 않는다(가용성 우선 — 상한은 비용 가드레일).
const GUEST_AI_DAILY_CAP = Number(Deno.env.get('GUEST_AI_DAILY_CAP') ?? 20)
const AUTH_AI_DAILY_CAP = Number(Deno.env.get('AUTH_AI_DAILY_CAP') ?? 200)

async function checkDailyCap(req: Request): Promise<Response | null> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const admin = createClient(url, key)
  const { data } = await admin.auth.getUser(jwt)
  const user = data?.user
  if (!user) {
    // 세션 토큰 없이 호출(구버전 앱·직접 호출) — 사용자 식별 불가 시 차단(무제한 우회 방지)
    return new Response(JSON.stringify({ error: 'auth_required' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  const cap = user.is_anonymous ? GUEST_AI_DAILY_CAP : AUTH_AI_DAILY_CAP
  const { data: count, error } = await admin.rpc('bump_usage', {
    p_user: user.id,
    p_kind: 'ai_chat',
  })
  if (error || typeof count !== 'number') return null
  if (count > cap) {
    return new Response(
      JSON.stringify({ error: 'daily_cap', cap, is_guest: user.is_anonymous === true }),
      { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
  return null
}

// 주력: Gemini 2.5 Flash-Lite — 실패(키 없음/오류) 시 null 반환해 Claude 폴백을 태운다
const GEMINI_MODEL = Deno.env.get('GGANBU_GEMINI_MODEL') ?? 'gemini-2.5-flash-lite'

async function callGemini(msgs: Msg[], sys: string, stream: boolean): Promise<Response | null> {
  const gkey = Deno.env.get('GEMINI_API_KEY')
  if (!gkey) return null
  const method = stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:${method}key=${gkey}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: msgs.map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }],
        })),
        generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
      }),
    })
    if (!res.ok) return null
    return res
  } catch {
    return null
  }
}

// Gemini SSE에서 텍스트 델타 추출
// deno-lint-ignore no-explicit-any
function geminiChunkText(ev: any): string {
  const parts = ev?.candidates?.[0]?.content?.parts ?? []
  // deno-lint-ignore no-explicit-any
  return parts.map((p: any) => p?.text ?? '').join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const blocked = await checkDailyCap(req)
    if (blocked) return blocked

    const {
      messages,
      language = 'en',
      location = 'Haeundae, Busan',
      dialect,
      context,
      coords,
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
    // 실데이터(Google 평점·영업 여부 + Naver 로컬)는 0.9s 상한이라 기본 수집 — 품질 우선, 속도 유지
    const [rag, live] = await Promise.all([
      useRag ? ragContext(dialect ? 'ko' : language) : Promise.resolve(''),
      livePlaceData(coords, location, dialect ? 'ko' : language),
    ])

    const sys = systemPrompt(language, location, rag + live, dialect, context)

    // ── 주력: Gemini 2.5 Flash-Lite ──
    const g = await callGemini(messages, sys, stream)
    if (g) {
      if (stream && g.body) {
        // Gemini SSE → 평문 스트림(클라이언트는 누적 텍스트만 읽음)
        const out = new ReadableStream({
          async start(controller) {
            const reader = g.body!.getReader()
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
                  const t = line.trim()
                  if (!t.startsWith('data:')) continue
                  try {
                    const txt = geminiChunkText(JSON.parse(t.slice(5).trim()))
                    if (txt) controller.enqueue(encoder.encode(txt))
                  } catch {
                    // 비JSON 라인 무시
                  }
                }
              }
            } catch {
              // 스트림 중단 — 받은 만큼 사용
            }
            controller.close()
          },
        })
        return new Response(out, {
          headers: {
            ...cors,
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
            'x-kgb-model': GEMINI_MODEL,
          },
        })
      }
      const gj = await g.json()
      const greply = geminiChunkText(gj)
      if (greply.trim()) {
        return new Response(JSON.stringify({ reply: greply }), {
          headers: { ...cors, 'Content-Type': 'application/json', 'x-kgb-model': GEMINI_MODEL },
        })
      }
      // 빈 응답 → 폴백 진행
    }

    // ── 폴백: Claude (기존 티어링) ──
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'no_key', message: 'AI 키 미설정' }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const tier = pickModel(messages)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: tier.model,
        max_tokens: tier.maxTokens,
        stream, // 스트리밍 요청 시 토큰 단위로 흘려보냄(체감 즉시 응답)
        system: sys,
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
          'x-kgb-model': tier.model, // 티어링 검증·계측용
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
      headers: { ...cors, 'Content-Type': 'application/json', 'x-kgb-model': tier.model },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
