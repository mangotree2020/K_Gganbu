-- =============================================================================
-- analytics_events — 전환 퍼널 이벤트 (PRD REQ-CP-4·REQ-AI-3, BM§7 북극성 지표)
-- =============================================================================
-- 클라이언트는 event/props/client_ts 만 insert (user_id 는 current_user_id() 자동).
-- 게스트(익명 세션)도 적립되며 linkIdentity 승격 시 auth.uid 불변 → 이력 연속.
-- 조회(select) 정책 없음 — 퍼널 분석은 대시보드/service role 전용.
-- 사용(used) 단계는 이벤트가 아니라 coupon_issues.used_at 과 조인해 계산한다.
create table public.analytics_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default public.current_user_id()
               references public.users(id) on delete cascade,
  event      text not null,                            -- ex) coupon_qr_issued
  props      jsonb not null default '{}'::jsonb,       -- 이벤트 속성 (coupon_id 등)
  client_ts  timestamptz not null,                     -- 발생 시각(기기) — 오프라인 큐 지연 보정
  created_at timestamptz not null default now()
);

create index idx_analytics_events_event_time on public.analytics_events(event, created_at desc);
create index idx_analytics_events_user_time  on public.analytics_events(user_id, created_at desc);

alter table public.analytics_events enable row level security;

create policy "analytics_events_insert_own" on public.analytics_events
  for insert with check (user_id = public.current_user_id());
