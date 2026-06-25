-- 여권 OCR (#26) — 원본 스캔 + 파싱 데이터.
-- 쓰기는 passport-ocr Edge Function(service role) 전용. 클라이언트는 본인 데이터만
-- read/delete (current_user_id RLS — voice_sessions/gganbu_sessions와 동일 프로젝트 표준).
-- 게스트→로그인 시 linkIdentity 동일 auth.uid → user_id 불변 → 데이터 자동 승계.
create table public.passport_scans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  image_path    text not null,
  raw_mrz       text,
  status        text not null default 'pending' check (status in ('pending','success','failed')),
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.passport_data (
  id              uuid primary key default gen_random_uuid(),
  scan_id         uuid not null references public.passport_scans(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  surname         text,
  given_name      text,
  nationality     text,
  passport_number text,
  date_of_birth   date,
  sex             text check (sex in ('M','F','X','<')),
  expiry_date     date,
  personal_number text,
  is_valid        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_passport_scans_user on public.passport_scans(user_id, created_at desc);
create index idx_passport_data_user  on public.passport_data(user_id, created_at desc);
create index idx_passport_data_scan  on public.passport_data(scan_id);

create trigger trg_passport_scans_updated_at before update on public.passport_scans
  for each row execute function public.set_updated_at();
create trigger trg_passport_data_updated_at before update on public.passport_data
  for each row execute function public.set_updated_at();

alter table public.passport_scans enable row level security;
alter table public.passport_data  enable row level security;

-- 본인 데이터만 read/delete (insert/update는 service role Edge Function 전용 → 정책 불필요)
create policy "passport_scans_select_own" on public.passport_scans
  for select using (user_id = public.current_user_id());
create policy "passport_scans_delete_own" on public.passport_scans
  for delete using (user_id = public.current_user_id());
create policy "passport_data_select_own" on public.passport_data
  for select using (user_id = public.current_user_id());
create policy "passport_data_delete_own" on public.passport_data
  for delete using (user_id = public.current_user_id());
