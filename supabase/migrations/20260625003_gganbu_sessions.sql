-- gganbu_sessions — AI 깐부 대화 세션(사용자별). voice_sessions와 동일 설계.
-- user_id 기본값 current_user_id() 자동 채움 + client_id 멱등 업로드 + RLS(본인만).
-- linkIdentity 로그인 승격 시 동일 auth.uid → user_id 불변 → 데이터 자동 승계.
create table public.gganbu_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default public.current_user_id()
                references public.users(id) on delete cascade,
  client_id   text unique,                          -- 멱등 업로드 키
  title       text,
  messages    jsonb not null default '[]'::jsonb,   -- [{role, text}]
  msg_count   int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_gganbu_sessions_user_recent on public.gganbu_sessions(user_id, created_at desc);

create trigger trg_gganbu_sessions_updated_at
  before update on public.gganbu_sessions
  for each row execute function public.set_updated_at();

alter table public.gganbu_sessions enable row level security;

create policy "gganbu_sessions_select_own" on public.gganbu_sessions
  for select using (user_id = public.current_user_id());
create policy "gganbu_sessions_insert_own" on public.gganbu_sessions
  for insert with check (user_id = public.current_user_id());
create policy "gganbu_sessions_delete_own" on public.gganbu_sessions
  for delete using (user_id = public.current_user_id());
