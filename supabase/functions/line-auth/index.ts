// line-auth — LINE 로그인(커스텀). Supabase는 LINE을 네이티브 provider로 지원하지 않으므로
// 앱이 받은 LINE 인가 code를 서버에서 토큰교환·검증한 뒤, magiclink 토큰을 발급해 돌려준다.
// 앱은 그 토큰으로 verifyOtp(token_hash) 하여 Supabase 세션을 확립한다(키 미노출).
// 채널 시크릿은 서버에만 둔다. 배포 시 verify_jwt=false 권장(로그인 전 호출 가능).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const LINE_CHANNEL_ID = Deno.env.get('LINE_CHANNEL_ID')
const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET) {
      return json({ error: 'no_line_config', message: 'LINE_CHANNEL_ID/SECRET 미설정' }, 502)
    }
    const { code, redirectUri } = await req.json().catch(() => ({}))
    if (!code || !redirectUri) {
      return json({ error: 'bad_request', message: 'code/redirectUri 필요' }, 400)
    }

    // 1. 인가 code → LINE 토큰(access_token + id_token)
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET,
      }),
    })
    const token = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok || !token?.id_token) {
      return json(
        {
          error: 'line_token_failed',
          detail: token?.error_description ?? `http_${tokenRes.status}`,
        },
        502,
      )
    }

    // 2. id_token 검증(LINE가 서명 검증) → 프로필(sub/name/picture/email)
    const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: token.id_token, client_id: LINE_CHANNEL_ID }),
    })
    const profile = await verifyRes.json().catch(() => ({}))
    if (!verifyRes.ok || !profile?.sub) {
      return json(
        {
          error: 'line_verify_failed',
          detail: profile?.error_description ?? `http_${verifyRes.status}`,
        },
        502,
      )
    }

    const sub = profile.sub as string
    // 이메일 scope는 LINE 심사 필요 → 없으면 합성 이메일로 안정적 매핑(동일 sub→동일 계정)
    const email = (profile.email as string | undefined) ?? `line_${sub}@users.kgganbu.app`
    const name = (profile.name as string | undefined) ?? 'LINE User'
    const picture = profile.picture as string | undefined

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 3. 유저 upsert — 신규면 생성, 이미 있으면(이메일 중복 에러) 무시하고 진행
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { provider: 'line', line_sub: sub, full_name: name, avatar_url: picture },
      app_metadata: { provider: 'line', providers: ['line'] },
    })
    if (created.error && !/already|exist|registered/i.test(created.error.message)) {
      return json({ error: 'user_upsert_failed', detail: created.error.message }, 502)
    }

    // 4. magiclink 토큰 발급 → 앱이 verifyOtp(token_hash)로 세션 확립
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (link.error || !link.data?.properties?.hashed_token) {
      return json({ error: 'link_failed', detail: link.error?.message ?? 'no_hashed_token' }, 502)
    }

    return json({ tokenHash: link.data.properties.hashed_token })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
