// coupon — 쿠폰 발급/검증 Edge Function (service role)
// PLANNING §22: one-time QR token(TTL 5분), 검증 시 즉시 소멸. RLS 우회는 여기서만.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { action, coupon_id, qr_token, used_location } = await req.json()
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    // ── 발급: 인증 사용자 본인에게 one-time QR 발급 ──
    if (action === 'issue') {
      const authHeader = req.headers.get('Authorization') ?? ''
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
      })
      const {
        data: { user },
      } = await userClient.auth.getUser()
      if (!user) return json({ error: 'unauthorized', message: '로그인이 필요합니다' }, 401)

      // auth_id → public.users.id
      const { data: appUser } = await admin
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()
      if (!appUser) return json({ error: 'no_profile', message: '사용자 프로필 없음' }, 404)
      if (!coupon_id) return json({ error: 'coupon_id 필수' }, 400)

      // 기기/사용자당 제한: 동일 쿠폰의 기존 'issued' 발급분은 만료 처리(재발급)
      await admin
        .from('coupon_issues')
        .update({ status: 'expired' })
        .eq('user_id', appUser.id)
        .eq('coupon_id', coupon_id)
        .eq('status', 'issued')

      const { data: issue, error } = await admin
        .from('coupon_issues')
        .insert({ coupon_id, user_id: appUser.id })
        .select('id, qr_token, expires_at, status')
        .single()
      if (error) return json({ error: error.message }, 400)

      return json({ issue })
    }

    // ── 검증/소멸: 파트너가 QR 토큰 제출 → 즉시 소멸 ──
    if (action === 'redeem') {
      if (!qr_token) return json({ error: 'qr_token 필수' }, 400)
      const { data: issue } = await admin
        .from('coupon_issues')
        .select('id, status, expires_at')
        .eq('qr_token', qr_token)
        .single()
      if (!issue) return json({ valid: false, reason: 'not_found' }, 404)
      if (issue.status !== 'issued') return json({ valid: false, reason: issue.status })
      if (new Date(issue.expires_at) < new Date()) {
        await admin.from('coupon_issues').update({ status: 'expired' }).eq('id', issue.id)
        return json({ valid: false, reason: 'expired' })
      }

      // 즉시 소멸(사용 처리 + 시간/위치 로그)
      await admin
        .from('coupon_issues')
        .update({
          status: 'used',
          used_at: new Date().toISOString(),
          used_location: used_location ?? null,
        })
        .eq('id', issue.id)
      return json({ valid: true })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
