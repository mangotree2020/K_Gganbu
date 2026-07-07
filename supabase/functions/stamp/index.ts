// stamp — 스탬프 투어 적립 (REQ-ST-1) — 매장 비치 QR 검증 → 방문당 50P
// QR: KGBSTAMP:{partner_id}:{stamp_secret} — 시크릿 불일치·비활성 파트너 거부.
// 하루 같은 매장 1회(멱등키), 일 상한 150P(=3개)는 earn_points 원장이 서버 강제.
// 방문 로그(stamp_visits)는 파트너 송객 증명 데이터(ST-3).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

const STAMP_POINTS = 50

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { code, lat, lng } = await req.json()
    if (typeof code !== 'string' || !code.startsWith('KGBSTAMP:')) {
      return json({ error: 'invalid_code' }, 400)
    }
    const [, partnerId, secret] = code.split(':')
    if (!partnerId || !secret) return json({ error: 'invalid_code' }, 400)

    // 인증 — 포인트는 계정 귀속, 게스트는 로그인 유도
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)
    if (user.is_anonymous) {
      return json({ error: 'guest_not_allowed', message: '포인트 적립은 로그인이 필요합니다' }, 403)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: appUser } = await admin.from('users').select('id').eq('auth_id', user.id).single()
    if (!appUser) return json({ error: 'no_profile' }, 404)

    // 파트너 검증 — 시크릿 일치 + 활성 상태
    const { data: partner } = await admin
      .from('partners')
      .select('id, name, stamp_secret, status')
      .eq('id', partnerId)
      .single()
    if (!partner || partner.stamp_secret !== secret) return json({ error: 'invalid_code' }, 400)
    if (partner.status && partner.status !== 'active')
      return json({ error: 'partner_inactive' }, 400)

    // 적립 — 하루 같은 매장 1회 멱등, 일 상한 150P는 원장이 캡
    const { data: earn, error } = await admin.rpc('earn_points', {
      p_user: appUser.id,
      p_source: 'stamp',
      p_amount: STAMP_POINTS,
      p_idem: `stamp:${appUser.id}:${partnerId}:${kstToday()}`,
      p_ref: partnerId,
      p_meta: { partner: partner.name },
    })
    if (error) return json({ error: error.message }, 500)

    // 방문 로그(송객 증명) — 실제 적립된 방문만 기록
    if (earn?.granted > 0) {
      await admin.from('stamp_visits').insert({
        user_id: appUser.id,
        partner_id: partnerId,
        lat: typeof lat === 'number' ? lat : null,
        lng: typeof lng === 'number' ? lng : null,
      })
    }

    return json({ ...earn, partnerName: partner.name })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
