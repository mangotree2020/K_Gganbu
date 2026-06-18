// gemini-live-token — Gemini Live API 직결용 ephemeral 토큰 발급 (PLANNING §25 B안)
// 기기가 Gemini Live(BidiGenerateContent WS)에 직접 연결하되, 장기 API 키는 서버에만 둔다.
// v1alpha AuthTokenService로 1회용 단기 토큰을 발급해 클라이언트에 전달(키 미노출).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL = 'models/gemini-3.5-live-translate-preview'
// Live WS 엔드포인트(클라이언트가 access_token=ephemeral 로 접속)
const WS_HOST = 'generativelanguage.googleapis.com'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return json({ error: 'no_key', message: 'GEMINI_API_KEY 미설정' }, 502)
    }

    const body = await req.json().catch(() => ({}))
    const targetLang: string = body.targetLang ?? 'ko'
    const sourceLang: string = body.sourceLang ?? 'auto'

    // 단기 ephemeral 토큰 — 짧은 만료 + 1회 세션 시작 제한 (키 보호)
    const now = Date.now()
    const res = await fetch(`https://${WS_HOST}/v1alpha/auth_tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        // 30분 내 1세션만 시작 가능, 토큰 자체는 곧 만료
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.name) {
      return json(
        { error: 'token_failed', detail: data?.error?.message ?? `http_${res.status}` },
        502,
      )
    }

    // data.name = "authTokens/xxxx" — 클라이언트가 access_token 으로 사용
    return json({
      token: data.name as string,
      wsHost: WS_HOST,
      model: MODEL,
      sourceLang,
      targetLang,
    })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
