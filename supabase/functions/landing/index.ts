// landing — 터미널·선내 QR 계측 리다이렉터 (PRD REQ-CR-4, BM§5 S-2)
// Supabase 도메인은 HTML 렌더를 차단(text/plain 강제)하므로 페이지 서빙 대신
// ?ch= 채널 방문을 landing_events에 계측한 뒤 실제 랜딩(외부 정적 호스팅)으로 302.
// QR에는 이 함수 URL을 인쇄한다 → 채널별 방문 수(E2: 하선객 설치율의 분모)가 쌓인다.
// LANDING_URL 시크릿(정적 랜딩 주소) 미설정 시 Play 스토어로 폴백.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.mangonw.gganbu'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const ch = url.searchParams.get('ch') ?? ''
  const lang = (req.headers.get('accept-language') ?? '').slice(0, 12)

  // 방문 계측 — 리다이렉트를 막지 않도록 백그라운드 기록
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const record = admin
    .from('landing_events')
    .insert({ ch: ch || null, lang, ua: (req.headers.get('user-agent') ?? '').slice(0, 200) })
    .then(() => {})
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime
  if (rt?.waitUntil) rt.waitUntil(record)
  else await record

  const base = Deno.env.get('LANDING_URL') ?? PLAY_URL
  const dest = ch ? `${base}${base.includes('?') ? '&' : '?'}ch=${encodeURIComponent(ch)}` : base
  return new Response(null, { status: 302, headers: { Location: dest } })
})
