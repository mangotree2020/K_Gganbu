// gemini-live-token — Gemini Live API 직결용 ephemeral 토큰 발급 (PLANNING §25 B안)
// 기기가 Gemini Live(BidiGenerateContent WS)에 직접 연결하되, 장기 API 키는 서버에만 둔다.
// v1alpha AuthTokenService로 1회용 단기 토큰을 발급해 클라이언트에 전달(키 미노출).
// 일일 세션 상한(REQ-TR-3, BM§3.3): 게스트 5회 / 로그인 30회 — 세션당 10분 상한과 함께 변동비 통제.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 범용 Live 모델 — 양방향 통역은 클라이언트 systemInstruction으로 제어(언어 자동 감지)
const MODEL = 'models/gemini-3.1-flash-live-preview'
// Live WS 엔드포인트(클라이언트가 access_token=ephemeral 로 접속)
const WS_HOST = 'generativelanguage.googleapis.com'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// 일일 음성 세션 상한 — 게스트 15회 / 로그인 60회 (env로 조정 가능).
// AI 깐부 탭 진입 시 STT 자동 시작도 세션 1회로 집계되므로 여유 있게 잡는다
// (비용의 실체는 세션 수가 아니라 오디오 분량 — 세션당 10분 상한이 주 방어선).
// 사용자 식별 불가(세션 토큰 없음) 시 발급 거부 — 키 남용 방지.
const GUEST_VOICE_DAILY_CAP = Number(Deno.env.get('GUEST_VOICE_DAILY_CAP') ?? 15)
const AUTH_VOICE_DAILY_CAP = Number(Deno.env.get('AUTH_VOICE_DAILY_CAP') ?? 60)

async function checkDailyCap(req: Request): Promise<Response | null> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const admin = createClient(url, key)
  const { data } = await admin.auth.getUser(jwt)
  const user = data?.user
  if (!user) return json({ error: 'auth_required' }, 401)
  const cap = user.is_anonymous ? GUEST_VOICE_DAILY_CAP : AUTH_VOICE_DAILY_CAP
  const { data: count, error } = await admin.rpc('bump_usage', {
    p_user: user.id,
    p_kind: 'voice_session',
  })
  // 카운터 인프라 오류는 차단 사유 아님(가용성 우선)
  if (error || typeof count !== 'number') return null
  if (count > cap)
    return json({ error: 'daily_cap', cap, is_guest: user.is_anonymous === true }, 429)
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const blocked = await checkDailyCap(req)
    if (blocked) return blocked

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
