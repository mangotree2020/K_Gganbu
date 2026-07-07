-- 스탬프 투어 (REQ-ST-1·3) — 제휴 매장 비치 QR 스캔 → 방문당 50P (일 상한 150P = 3개 서버 캡)
-- QR 콘텐츠: KGBSTAMP:{partner_id}:{stamp_secret} — 매장별 시크릿으로 위조 방지(GPS 단독 인증 금지).
-- 검증·적립은 Edge Function(stamp, service role) 전용. stamp_visits = 파트너 송객 증명 로그(ST-3).

-- 파트너별 스탬프 시크릿 (매장 비치 QR 인쇄용)
alter table public.partners add column if not exists stamp_secret text;
update public.partners set stamp_secret = encode(gen_random_bytes(8), 'hex') where stamp_secret is null;

-- 방문 로그 — 송객비 과금 데이터 근거 (일시·위치)
create table public.stamp_visits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  lat        double precision,
  lng        double precision,
  created_at timestamptz not null default now()
);

create index idx_stamp_visits_user on public.stamp_visits (user_id, created_at desc);
create index idx_stamp_visits_partner on public.stamp_visits (partner_id, created_at desc);

alter table public.stamp_visits enable row level security;

-- 본인 방문 이력만 조회 — 쓰기는 Edge Function(service role) 전용
create policy "stamp_visits_select_own" on public.stamp_visits
  for select using (user_id = public.current_user_id());
