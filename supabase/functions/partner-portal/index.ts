// partner-portal — 파트너 포털 API (PRD REQ-PTL-1~5)
//
// 인증: 매장별 **접근 코드**(x-partner-code). 관리자 키를 파트너에게 주지 않는다 —
//   코드 한 장이 유출돼도 반경이 그 매장으로 제한된다(회전도 매장 단위).
// 범위 강제: 클라이언트가 보낸 partner_id 를 신뢰하지 않고, 코드에서 해석한 partner_id 로만
//   모든 쿼리를 건다. 이게 이 함수의 존재 이유다.
// 개인정보: 방문자 식별자를 내보내지 않는다(시각·집계만).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-partner-code',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

// 파트너 입력(한국어) → 앱 5개 로케일 i18n jsonb.
// 앱은 title_i18n[사용자언어] → en 순으로 읽는다. 한국어만 넣으면 일본·중화권 사용자에게
// 한국어가 그대로 노출되므로(사실상 못 읽는 문자열), 등록 시점에 번역해 채운다.
// 번역 실패는 등록을 막지 않는다 — 최소 ko/en 은 채워 앱이 빈칸을 그리지 않게 한다.
async function toI18n(text: string): Promise<Record<string, string>> {
  const fallback = { ko: text, en: text }
  if (!text) return {}
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/translate-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({ text, source: 'ko' }),
    })
    const j = await res.json().catch(() => ({}))
    return j?.i18n && Object.keys(j.i18n).length ? j.i18n : fallback
  } catch {
    return fallback
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const body = await req.json().catch(() => ({}))
    const code = (req.headers.get('x-partner-code') ?? body.code ?? '').trim()
    if (!code) return json({ error: 'code_required' }, 401)

    // 코드 → partner_id (서버가 결정, 클라이언트 입력 무시)
    const { data: partnerId } = await admin.rpc('partner_by_code', { p_code: code })
    if (!partnerId) return json({ error: 'invalid_code' }, 401)

    const { data: partner } = await admin
      .from('partners')
      .select('id, name, address, lat, lng, status')
      .eq('id', partnerId)
      .single()

    const action: string = body.action ?? 'summary'

    // ── 오늘 요약 + 송객 리포트 (REQ-PTL-3·4) ──
    if (action === 'summary') {
      const today = kstToday()
      const since7 = new Date(Date.now() - 7 * 86400_000).toISOString()
      const since30 = new Date(Date.now() - 30 * 86400_000).toISOString()

      const { data: coupons } = await admin
        .from('coupons')
        .select('id, title_i18n, category, status, valid_until')
        .eq('partner_id', partnerId)
      const ids = (coupons ?? []).map((c) => c.id)

      const { data: issues } = ids.length
        ? await admin
            .from('coupon_issues')
            .select('coupon_id, status, issued_at, used_at')
            .in('coupon_id', ids)
        : { data: [] }

      const rows = (issues ?? []) as {
        coupon_id: string
        status: string
        issued_at: string
        used_at: string | null
      }[]
      const usedRows = rows.filter((r) => r.used_at)
      const isToday = (iso: string) =>
        new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10) === today

      const { data: visits } = await admin
        .from('stamp_visits')
        .select('user_id, created_at')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false })
        .limit(1000)
      const v = (visits ?? []) as { user_id: string; created_at: string }[]

      return json({
        partner: {
          name: partner?.name ?? '',
          address: partner?.address ?? null,
          // 좌표가 없으면 앱 딜 매칭이 되지 않는다 — 파트너가 알아야 하는 사실
          has_coords: partner?.lat != null && partner?.lng != null,
        },
        today: {
          used: usedRows.filter((r) => isToday(r.used_at!)).length,
          issued: rows.filter((r) => isToday(r.issued_at)).length,
          stamp_visits: v.filter((x) => isToday(x.created_at)).length,
          last_used_at: usedRows[0]?.used_at ?? null,
        },
        referral: {
          visits_total: v.length,
          unique_visitors: new Set(v.map((x) => x.user_id)).size,
          visits_7d: v.filter((x) => x.created_at >= since7).length,
          visits_30d: v.filter((x) => x.created_at >= since30).length,
          recent: v.slice(0, 10).map((x) => x.created_at), // 시각만 (식별자 제외)
        },
        coupons: (coupons ?? []).map((c) => {
          const mine = rows.filter((r) => r.coupon_id === c.id)
          const used = mine.filter((r) => r.used_at).length
          return {
            id: c.id,
            title: c.title_i18n?.ko ?? c.title_i18n?.en ?? c.id,
            category: c.category,
            status: c.status,
            valid_until: c.valid_until,
            issued: mine.length,
            used,
            use_rate: mine.length ? Math.round((used * 1000) / mine.length) / 10 : 0,
            // 앱과 동일한 판정 — 파트너가 "운영 중인데 왜 손님이 없지"를 겪지 않도록
            visible_in_app:
              c.status === 'active' &&
              (!c.valid_until || new Date(c.valid_until).getTime() >= Date.now()),
          }
        }),
      })
    }

    // ── QR 검증 (REQ-PTL-2) — 내 매장 쿠폰만 소멸 처리 ──
    if (action === 'redeem') {
      const token = String(body.token ?? '').trim()
      if (!token) return json({ error: 'token_required' }, 400)

      const { data: issue } = await admin
        .from('coupon_issues')
        .select('id, coupon_id, status, expires_at, used_at')
        .eq('qr_token', token)
        .maybeSingle()
      if (!issue) return json({ result: 'invalid' })

      // 다른 매장 쿠폰을 이 매장에서 소멸시킬 수 없다
      const { data: coupon } = await admin
        .from('coupons')
        .select('id, partner_id, title_i18n')
        .eq('id', issue.coupon_id)
        .single()
      if (!coupon || coupon.partner_id !== partnerId) return json({ result: 'other_partner' })

      if (issue.status === 'used' || issue.used_at) return json({ result: 'already_used' })
      if (issue.expires_at && new Date(issue.expires_at).getTime() < Date.now()) {
        return json({ result: 'expired' })
      }

      const { error } = await admin
        .from('coupon_issues')
        .update({ status: 'used', used_at: new Date().toISOString() })
        .eq('id', issue.id)
      if (error) return json({ error: error.message }, 500)

      return json({
        result: 'ok',
        title: coupon.title_i18n?.ko ?? coupon.title_i18n?.en ?? '',
      })
    }

    // ── 쿠폰 등록/중지 (REQ-PTL-5) — 항상 내 partner_id 로만 ──
    if (action === 'coupon_create') {
      const title = String(body.title ?? '').trim()
      const discountType = body.discount_type
      if (!title || !discountType) return json({ error: 'title/discount_type required' }, 400)
      // 앱이 읽는 형태(5개 로케일)로 맞춰 저장 — 앱이 기준이다
      const [titleI18n, condI18n] = await Promise.all([
        toI18n(title),
        toI18n(String(body.condition ?? '').trim()),
      ])
      const { data, error } = await admin
        .from('coupons')
        .insert({
          partner_id: partnerId, // 클라이언트 값이 아니라 코드에서 해석한 것
          title_i18n: titleI18n,
          discount_type: discountType,
          discount_value: body.discount_value ?? null,
          category: body.category ?? null,
          usage_condition_i18n: condI18n,
          valid_until: body.valid_until ?? null,
          status: 'active',
        })
        .select('id')
        .single()
      if (error) return json({ error: error.message }, 500)
      return json({ id: data.id }, 201)
    }

    if (action === 'coupon_stop') {
      const id = String(body.coupon_id ?? '')
      const { data: stopped, error } = await admin
        .from('coupons')
        .update({ status: 'inactive' })
        .eq('id', id)
        .eq('partner_id', partnerId) // 남의 쿠폰은 건드릴 수 없다
        .select('id')
      if (error) return json({ error: error.message }, 500)
      // 0건이면 내 매장 쿠폰이 아니다 — ok 를 돌려주면 "중지했다"고 오해한다
      if (!stopped?.length) return json({ error: 'not_found' }, 404)
      return json({ ok: true })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'internal_error' }, 500)
  }
})
