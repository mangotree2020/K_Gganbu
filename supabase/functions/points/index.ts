// points — 포인트 원장 API (PRD REQ-PT-1·2·3·4, BM§3.5)
// 적립·차감 RPC 는 service role 전용이므로 모든 쓰기는 이 함수를 경유한다.
// actions:
//   summary        — 잔액·소멸 예정·최근 내역 + 등급 (본인 RLS 경유 조회)
//   earn_steps     — 만보기 적립: 1,000보=10P·일 상한 100P·하루 1회 멱등 (REQ-PD-2 정책)
//                    정밀 부정 검증(verified_steps·Activity Recognition)은 R2 REQ-PD-2 에서 추가.
//   earn_challenge — 한국어 챌린지 완료: 하루 1회 20P (REQ-KL-4)
//   earn_game      — 게임 승리: 승리당 10P (REQ-GM-2)
//   게스트(anonymous)는 적립 불가 → 로그인 유도 (REQ-PT-4)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

// 만보기 규칙 (BM§3.5 · src/features/points/pedometer.ts 와 동일 상수)
const STEP_POINT_UNIT = 1000
const STEP_POINT_PER_UNIT = 10
const STEP_POINT_DAILY_CAP = 100
const MAX_DAILY_STEPS = 200_000 // 명백한 비정상 신고값 차단 (1차 sanity)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// KST 기준 오늘 날짜 (일 1회 멱등키·상한 기준일 — DB의 Asia/Seoul 기준과 일치)
function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { action, steps } = await req.json()

    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return json({ error: 'unauthorized', message: '로그인이 필요합니다' }, 401)

    // ── 잔액·최근 내역 + 등급 (RLS 경유 — 본인 데이터만) ──
    if (action === 'summary') {
      const [{ data: balance }, { data: history }] = await Promise.all([
        userClient
          .from('points_balance')
          .select('balance, next_expires_at, expiring_30d')
          .maybeSingle(),
        userClient
          .from('points_ledger')
          .select('id, kind, source, amount, created_at, expires_at')
          .order('created_at', { ascending: false })
          .limit(20),
      ])
      // 등급(REQ-PT-3) — user_tier 는 service role 전용이라 여기서 조회해 함께 내려준다.
      // 게스트는 원장 자체가 없어 기본 등급(seed) 폴백.
      let tier: unknown = null
      if (!user.is_anonymous) {
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
        const { data: appUser } = await admin
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .maybeSingle()
        if (appUser) {
          const { data } = await admin.rpc('user_tier', { p_user: appUser.id })
          tier = data ?? null
        }
      }
      return json({
        balance: balance?.balance ?? 0,
        next_expires_at: balance?.next_expires_at ?? null,
        expiring_30d: balance?.expiring_30d ?? 0,
        history: history ?? [],
        tier,
      })
    }

    // ── 만보기 적립 (하루 1회 멱등) ──
    if (action === 'earn_steps') {
      // 게스트는 적립 불가 — 포인트가 핵심 가입 트리거 (REQ-PT-4)
      if (user.is_anonymous) {
        return json(
          { error: 'guest_not_allowed', message: '포인트 적립은 로그인이 필요합니다' },
          403,
        )
      }
      const n = Number(steps)
      if (!Number.isInteger(n) || n <= 0 || n > MAX_DAILY_STEPS) {
        return json({ error: 'invalid_steps' }, 400)
      }

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
      const { data: appUser } = await admin
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()
      if (!appUser) return json({ error: 'no_profile', message: '사용자 프로필 없음' }, 404)

      const points = Math.min(
        STEP_POINT_DAILY_CAP,
        Math.floor(n / STEP_POINT_UNIT) * STEP_POINT_PER_UNIT,
      )
      if (points <= 0) return json({ ok: true, granted: 0, reason: 'below_unit' })

      const { data, error } = await admin.rpc('earn_points', {
        p_user: appUser.id,
        p_source: 'steps',
        p_amount: points,
        p_idem: `steps:${appUser.id}:${kstToday()}`, // 하루 1회 — 재호출은 duplicate
        p_meta: { steps: n },
      })
      if (error) return json({ error: error.message }, 500)
      return json(data)
    }

    // ── 한국어 챌린지 완료 적립 (REQ-KL-4) — 하루 1회 20P, 상한 30P(challenge·game 공유) ──
    // 정답 수는 표시용일 뿐 지급액을 바꾸지 않는다: 클라이언트 신고 값이라 신뢰할 수 없고,
    // "매일 연다"는 리텐션 목표에는 완주 여부만 있으면 충분하다.
    if (action === 'earn_challenge') {
      if (user.is_anonymous) {
        return json(
          { error: 'guest_not_allowed', message: '포인트 적립은 로그인이 필요합니다' },
          403,
        )
      }
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
      const { data: appUser } = await admin
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()
      if (!appUser) return json({ error: 'no_profile' }, 404)
      // 완주일 기록 (REQ-KL-2) — 보상이 상한에 걸려 0P여도 학습은 한 것이므로 별도로 남긴다.
      // 이 기록이 연속 출석(streak)의 서버 원장이다.
      await admin
        .from('challenge_days')
        .upsert({ user_id: appUser.id, day: kstToday() }, { onConflict: 'user_id,day' })

      const { data, error } = await admin.rpc('earn_points', {
        p_user: appUser.id,
        p_source: 'challenge',
        p_amount: 20,
        p_idem: `challenge:${appUser.id}:${kstToday()}`, // 하루 1회 — 재호출은 duplicate
        p_meta: { kind: 'daily_korean' },
      })
      if (error) return json({ error: error.message }, 500)
      return json(data)
    }

    // ── 게임 승리 적립 (REQ-GM-2) — 승리당 10P, 일 상한 30P(challenge·game 공유)는 서버 강제 ──
    if (action === 'earn_game') {
      if (user.is_anonymous) {
        return json(
          { error: 'guest_not_allowed', message: '포인트 적립은 로그인이 필요합니다' },
          403,
        )
      }
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
      const { data: appUser } = await admin
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()
      if (!appUser) return json({ error: 'no_profile' }, 404)
      const { data, error } = await admin.rpc('earn_points', {
        p_user: appUser.id,
        p_source: 'game',
        p_amount: 10,
        p_idem: `game:${appUser.id}:${Date.now()}`, // 승리 건별 — 상한은 earn_points가 캡
        p_meta: { game: 'rps' },
      })
      if (error) return json({ error: error.message }, 500)
      return json(data)
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'internal_error' }, 500)
  }
})
