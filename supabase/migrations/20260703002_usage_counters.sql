-- 일일 사용량 카운터 (REQ-TR-3, BM§3.3 변동비 통제)
-- 게스트/로그인 사용자별 AI 챗·음성통역 세션 사용량을 KST 일 단위로 집계.
-- 적립·조회는 Edge Function(service role) 전용 — 클라이언트 정책 없음.
create table if not exists public.usage_counters (
  user_id uuid not null,
  day date not null,
  kind text not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day, kind)
);

alter table public.usage_counters enable row level security;

-- 원자적 증가 후 현재 카운트 반환 (경쟁 요청에도 상한 우회 불가)
create or replace function public.bump_usage(p_user uuid, p_kind text)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into usage_counters (user_id, day, kind, count)
  values (p_user, (now() at time zone 'Asia/Seoul')::date, p_kind, 1)
  on conflict (user_id, day, kind)
  do update set count = usage_counters.count + 1, updated_at = now()
  returning count;
$$;

revoke all on function public.bump_usage(uuid, text) from public, anon, authenticated;
