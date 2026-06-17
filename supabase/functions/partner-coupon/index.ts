// partner-coupon — 파트너 쿠폰 등록/목록 (PLANNING Phase 2 "Admin 기본형: 파트너 쿠폰 등록")
// Admin UI(별도 앱)가 호출하는 백엔드 primitive. coupons 쓰기는 RLS 우회(service role)가
// 필요하므로 Edge Function에서만 처리(§20·§22 원칙). 공유 시크릿 ADMIN_API_KEY로 게이트.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ADMIN_API_KEY = Deno.env.get('ADMIN_API_KEY')

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

type RegisterBody = {
  action: 'register' | 'list'
  partner_id: string
  title_i18n?: Record<string, string>
  discount_type?: 'percentage' | 'fixed' | 'freebie'
  discount_value?: number | null
  usage_condition_i18n?: Record<string, string>
  category?: string
  place_id?: string | null
  valid_from?: string
  valid_until?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    // 공유 시크릿 게이트 (Admin 앱 전용). 미설정 시 비활성(503).
    if (!ADMIN_API_KEY)
      return json({ error: 'admin_disabled', message: 'ADMIN_API_KEY 미설정' }, 503)
    if (req.headers.get('x-admin-key') !== ADMIN_API_KEY)
      return json({ error: 'unauthorized' }, 401)

    const body: RegisterBody = await req.json()
    const { action, partner_id } = body
    if (!partner_id) return json({ error: 'partner_id는 필수입니다' }, 400)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    // 파트너 존재·활성 확인
    const { data: partner } = await admin
      .from('partners')
      .select('id, status')
      .eq('id', partner_id)
      .maybeSingle()
    if (!partner) return json({ error: 'partner_not_found' }, 404)
    if (partner.status !== 'active') return json({ error: 'partner_inactive' }, 403)

    // ── 목록: 파트너 쿠폰 조회 ──
    if (action === 'list') {
      const { data, error } = await admin
        .from('coupons')
        .select('id, title_i18n, discount_type, discount_value, category, status, valid_until')
        .eq('partner_id', partner_id)
        .order('created_at', { ascending: false })
      if (error) return json({ error: error.message }, 500)
      return json({ coupons: data ?? [] })
    }

    // ── 등록: 신규 쿠폰 생성 ──
    if (action === 'register') {
      const { title_i18n, discount_type } = body
      if (!title_i18n || Object.keys(title_i18n).length === 0 || !discount_type) {
        return json({ error: 'title_i18n, discount_type는 필수입니다' }, 400)
      }
      const { data, error } = await admin
        .from('coupons')
        .insert({
          partner_id,
          title_i18n,
          discount_type,
          discount_value: body.discount_value ?? null,
          usage_condition_i18n: body.usage_condition_i18n ?? {},
          category: body.category ?? null,
          place_id: body.place_id ?? null,
          valid_from: body.valid_from ?? null,
          valid_until: body.valid_until ?? null,
          status: 'active',
        })
        .select('id')
        .single()
      if (error) return json({ error: error.message }, 500)
      return json({ id: data.id, status: 'active' }, 201)
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
