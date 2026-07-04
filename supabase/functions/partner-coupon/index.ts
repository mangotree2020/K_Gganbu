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

// 매장 주소(또는 상호) → 좌표 지오코딩 (Google Find Place, place-lookup과 동일 키).
// LBS 딜 매칭의 기반 — 실패 시 null(등록은 계속 진행, 좌표만 비움).
async function geocode(q: string): Promise<{ lat: number; lng: number; address: string } | null> {
  const key = Deno.env.get('GOOGLE_PLACES_API_KEY') ?? Deno.env.get('GOOGLE_MAPS_API_KEY')
  if (!key) return null
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
      `?input=${encodeURIComponent(q)}&inputtype=textquery` +
      `&fields=geometry/location,formatted_address&key=${key}`
    const res = await fetch(url)
    const data = await res.json()
    const c = data?.candidates?.[0]
    const loc = c?.geometry?.location
    if (typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') return null
    return { lat: loc.lat, lng: loc.lng, address: c?.formatted_address ?? q }
  } catch {
    return null
  }
}

type RegisterBody = {
  action: 'register' | 'list' | 'partners' | 'partner_create' | 'stats'
  partner_id?: string
  name?: string
  contact?: string
  address?: string // 매장 주소 — 등록 시 지오코딩해 lat/lng 저장(LBS 딜 매칭)
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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    // ── 파트너 목록 (partner_id 불필요) ──
    if (action === 'partners') {
      const { data, error } = await admin
        .from('partners')
        .select('id, name, contact, status, address, lat, lng')
        .order('name')
      if (error) return json({ error: error.message }, 500)
      return json({ partners: data ?? [] })
    }

    // ── 파트너 등록 (partner_id 불필요) ──
    // 주소(없으면 상호+Busan)를 지오코딩해 매장 좌표를 함께 저장 → 홈 추천 LBS 딜 매칭에 사용
    if (action === 'partner_create') {
      if (!body.name) return json({ error: 'name은 필수입니다' }, 400)
      const geo = await geocode(body.address ?? `${body.name} Busan`)
      const { data, error } = await admin
        .from('partners')
        .insert({
          name: body.name,
          contact: body.contact ?? null,
          status: 'active',
          address: geo?.address ?? body.address ?? null,
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
        })
        .select('id')
        .single()
      if (error) return json({ error: error.message }, 500)
      return json({ id: data.id, lat: geo?.lat ?? null, lng: geo?.lng ?? null }, 201)
    }

    if (!partner_id) return json({ error: 'partner_id는 필수입니다' }, 400)

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

    // ── 통계: 쿠폰별 발급/사용 수 + 최근 사용 로그 (REQ-ADM-3, 스탬프 송객 리포트 근거) ──
    if (action === 'stats') {
      const { data: coupons, error } = await admin
        .from('coupons')
        .select('id, title_i18n')
        .eq('partner_id', partner_id)
      if (error) return json({ error: error.message }, 500)
      const ids = (coupons ?? []).map((c) => c.id)
      if (!ids.length) return json({ stats: [], recent: [] })

      const { data: issues } = await admin
        .from('coupon_issues')
        .select('coupon_id, status, used_at')
        .in('coupon_id', ids)
      const byId: Record<string, { issued: number; used: number }> = {}
      for (const i of issues ?? []) {
        const s = (byId[i.coupon_id] ??= { issued: 0, used: 0 })
        s.issued++
        if (i.status === 'used') s.used++
      }
      const stats = (coupons ?? []).map((c) => ({
        coupon_id: c.id,
        title: c.title_i18n?.ko ?? c.title_i18n?.en ?? c.id,
        issued: byId[c.id]?.issued ?? 0,
        used: byId[c.id]?.used ?? 0,
      }))
      const recent = (issues ?? [])
        .filter((i) => i.status === 'used' && i.used_at)
        .sort((a, b) => (a.used_at! < b.used_at! ? 1 : -1))
        .slice(0, 20)
        .map((i) => ({ coupon_id: i.coupon_id, used_at: i.used_at }))
      return json({ stats, recent })
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
