-- device_tokens — FCM 디바이스 토큰 (PRD REQ-NT-1)
-- 클라이언트가 opt-in 시 upsert. 발송은 push-send Edge Function(service role)이 조회.
create table public.device_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default public.current_user_id()
               references public.users(id) on delete cascade,
  token      text not null unique,
  platform   text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_device_tokens_user on public.device_tokens(user_id);

create trigger trg_device_tokens_updated_at
  before update on public.device_tokens
  for each row execute function public.set_updated_at();

alter table public.device_tokens enable row level security;

create policy "device_tokens_select_own" on public.device_tokens
  for select using (user_id = public.current_user_id());
create policy "device_tokens_insert_own" on public.device_tokens
  for insert with check (user_id = public.current_user_id());
create policy "device_tokens_update_own" on public.device_tokens
  for update using (user_id = public.current_user_id());
create policy "device_tokens_delete_own" on public.device_tokens
  for delete using (user_id = public.current_user_id());
