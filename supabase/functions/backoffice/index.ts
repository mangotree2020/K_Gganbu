// backoffice — 역할별 대시보드 집계 API (PRD REQ-BO-2)
// 게이트: ADMIN_API_KEY(x-admin-key) 또는 ADMIN_EMAILS JWT — partner-coupon 과 동일 체계.
//
// 계산은 전부 DB 함수(bo_*)에 있다. 화면이 각자 계산하면 같은 지표가 화면마다 다른 값을 내고
// 그 순간 대시보드는 신뢰를 잃는다. 여기서는 라우팅과 권한만 담당한다.
// 응답에 개인식별자(사용자 id·이메일)를 포함하지 않는다.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { isAdmin } from '../_shared/adminAuth.ts'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!(await isAdmin(req))) return json({ error: 'unauthorized' }, 401)

  try {
    const body = await req.json().catch(() => ({}))
    const section: string = body.section ?? 'overview'
    const days = Math.min(Math.max(Number(body.days ?? 7), 1), 365) // 과도한 범위 조회 차단

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 섹션 → DB 함수 매핑. 알 수 없는 섹션은 거부(임의 RPC 호출 방지)
    const rpc: Record<string, { fn: string; args: Record<string, unknown> }> = {
      overview: { fn: 'bo_overview', args: { p_days: days } },
      product: { fn: 'bo_product', args: { p_days: days } },
      merchandising: { fn: 'bo_merchandising', args: { p_days: days } },
      growth: { fn: 'bo_growth', args: { p_days: days } },
      timeseries: { fn: 'bo_timeseries', args: { p_days: days } },
      system: { fn: 'bo_system', args: {} },
    }
    const target = rpc[section]
    if (!target) return json({ error: 'unknown_section' }, 400)

    const { data, error } = await admin.rpc(target.fn, target.args)
    if (error) return json({ error: error.message }, 500)
    return json({ section, days, data })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'internal_error' }, 500)
  }
})
