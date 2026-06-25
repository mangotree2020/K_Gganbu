-- =============================================================================
-- voice_sessions — 음성 통역 대화 세션(사용자별 이력)
-- =============================================================================
-- 게스트(익명 auth.users 포함) 별로 보관. linkIdentity 로 소셜/전화 로그인 승격 시
-- auth.uid() 가 동일하게 유지되므로 public.users.id(=user_id) 도 불변 → 로그인 전
-- 익명 상태에서 저장한 세션이 로그인 후에도 그대로 연결된다(별도 이관 불필요).
--
-- user_id 는 DB 기본값 current_user_id() 로 자동 채움 → 클라이언트는 user_id 미지정 insert.
create table public.voice_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default public.current_user_id()
                references public.users(id) on delete cascade,
  my_lang     text,                                  -- 내(앱 사용자) 언어 코드
  peer_lang   text,                                  -- 상대 언어 코드
  turns       jsonb not null default '[]'::jsonb,    -- [{original, translation, lang}]
  turn_count  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_voice_sessions_user_id    on public.voice_sessions(user_id);
create index idx_voice_sessions_user_recent on public.voice_sessions(user_id, created_at desc);

create trigger trg_voice_sessions_updated_at
  before update on public.voice_sessions
  for each row execute function public.set_updated_at();

-- RLS (rls_auto_enable 이벤트 트리거가 자동 활성화하지만 명시적으로도 보장)
alter table public.voice_sessions enable row level security;

create policy "voice_sessions_select_own" on public.voice_sessions
  for select using (user_id = public.current_user_id());
create policy "voice_sessions_insert_own" on public.voice_sessions
  for insert with check (user_id = public.current_user_id());
create policy "voice_sessions_delete_own" on public.voice_sessions
  for delete using (user_id = public.current_user_id());
