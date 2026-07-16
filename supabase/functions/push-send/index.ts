// push-send — FCM HTTP v1 푸시 발송 (PRD REQ-NT-1, 크루즈 승선 알림 등 서버 발송용)
// 게이트: x-admin-key === ADMIN_API_KEY (partner-coupon과 동일 패턴) — 클라이언트 직접 호출 차단.
// 시크릿: FCM_SERVICE_ACCOUNT(우선) 또는 FIREBASE_SERVICE_ACCOUNT — Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > 비공개 키(JSON 전체).
// body: { user_id? , token?, title, body, data? } — user_id면 등록된 전체 기기로 발송.
// body: { action: 'targets' } — 발송 대상 선택용 최근 등록 기기 목록(Admin 웹 푸시 탭).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

type ServiceAccount = { client_email: string; private_key: string; project_id: string }

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// 서비스 계정 JWT(RS256) 서명 → OAuth2 access token 교환
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  const unsigned = `${header}.${claims}`
  // PEM(PKCS8) → CryptoKey
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`token_exchange_failed: ${JSON.stringify(data)}`)
  return data.access_token as string
}

async function sendToToken(
  sa: ServiceAccount,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { token, notification: { title, body }, data } }),
  })
  if (res.ok) return { ok: true }
  const err = await res.text()
  return { ok: false, error: err.slice(0, 300) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const adminKey = Deno.env.get('ADMIN_API_KEY')
  if (!adminKey || req.headers.get('x-admin-key') !== adminKey)
    return json({ error: 'forbidden' }, 403)

  try {
    const body = await req.json()

    // 발송 대상 목록 — FCM 키 불필요, service role로 최근 등록 기기 조회
    if (body.action === 'targets') {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      const { data: rows, error } = await admin
        .from('device_tokens')
        .select('user_id, token, platform, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) return json({ error: 'list_failed', detail: error.message }, 500)
      return json({
        targets: (rows ?? []).map((r) => ({
          user_id: r.user_id,
          platform: r.platform,
          created_at: r.created_at,
          token: r.token,
          token_tail: r.token.slice(-8),
        })),
      })
    }

    const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT') ?? Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!saRaw) return json({ error: 'no_key', message: 'FCM_SERVICE_ACCOUNT 미설정' }, 502)
    const sa = JSON.parse(saRaw) as ServiceAccount
    const title: string = body.title ?? ''
    const msg: string = body.body ?? ''
    const data: Record<string, string> | undefined = body.data
    if (!title || !msg) return json({ error: 'title/body required' }, 400)

    // 대상 토큰 결정 — 직접 토큰 또는 user_id의 등록 기기 전체
    let tokens: string[] = []
    if (body.token) tokens = [body.token]
    else if (body.user_id) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      const { data: rows } = await admin
        .from('device_tokens')
        .select('token')
        .eq('user_id', body.user_id)
      tokens = (rows ?? []).map((r) => r.token)
    }
    if (!tokens.length) return json({ error: 'no_target_tokens' }, 404)

    const accessToken = await getAccessToken(sa)
    const results = await Promise.all(
      tokens.map((t) => sendToToken(sa, accessToken, t, title, msg, data)),
    )
    return json({
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).map((r) => r.error),
    })
  } catch (e) {
    return json({ error: 'send_failed', detail: String(e) }, 500)
  }
})
