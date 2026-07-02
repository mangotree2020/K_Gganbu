-- landing_events — QR 랜딩 방문 계측 (PRD REQ-CR-4, BM§7 E2: 하선객 설치율)
-- 랜딩은 미인증 웹이므로 user_id 없이 채널/언어만 기록. 쓰기는 landing Edge Function(service role) 전용.
create table public.landing_events (
  id         uuid primary key default gen_random_uuid(),
  ch         text,             -- 배포 채널 파라미터 (?ch=terminal / msc-0703 등)
  lang       text,             -- 브라우저 언어
  ua         text,             -- User-Agent (기기 파악용)
  created_at timestamptz not null default now()
);

create index idx_landing_events_ch_time on public.landing_events(ch, created_at desc);

alter table public.landing_events enable row level security;
-- 정책 없음 = 클라이언트 접근 불가 (service role 전용)
