-- =============================================================================
-- K-Gganbu 초기 스키마 (PLANNING.md §20 기준)
-- - 전 테이블 RLS 활성화 + 기본 정책
-- - 다국어 컬럼: jsonb {en, zh-CN, zh-TW, ja, ko}
-- - users ↔ auth.users 연동 (on insert trigger)
-- - coupon_issues: one-time QR token + expires_at (TTL 5분)
-- - created_at/updated_at 전 테이블 자동 (trigger)
-- =============================================================================

-- 확장 (Supabase 기본 포함, 안전을 위해 명시)
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- ENUM 타입
-- -----------------------------------------------------------------------------
create type place_source        as enum ('tourapi', 'curated', 'partner');
create type coupon_discount_type as enum ('percentage', 'fixed', 'freebie');
create type coupon_status       as enum ('active', 'inactive', 'expired');
create type coupon_issue_status as enum ('issued', 'used', 'expired', 'revoked');
create type ticket_status       as enum ('active', 'soldout', 'inactive');
create type partner_status      as enum ('active', 'pending', 'suspended');
create type favorite_type       as enum ('place', 'coupon', 'ticket');

-- -----------------------------------------------------------------------------
-- 공통 함수
-- -----------------------------------------------------------------------------

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- 1. users — auth.users 와 1:1 연동
-- =============================================================================
create table public.users (
  id                 uuid primary key default gen_random_uuid(),
  auth_id            uuid unique references auth.users(id) on delete cascade,
  anonymous_id       text,                          -- Guest(비로그인) 기기 식별자
  email              text,
  provider           text,                          -- google | apple | phone | anonymous
  nationality        text,
  preferred_language text default 'en',             -- en | zh-CN | zh-TW | ja | ko
  travel_region      text,                          -- busan | seoul | jeju ...
  interests          text[] default '{}',           -- food | k-culture | shopping ...
  party_type         text,                          -- solo | couple | family | group
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  last_active_at     timestamptz not null default now()
);

create index idx_users_auth_id on public.users(auth_id);

-- auth.uid() → public.users.id 매핑 (RLS 정책에서 사용)
-- security definer 로 users RLS 를 우회하므로 정책 내 재귀 없음. users 테이블 생성 후 정의.
create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.users where auth_id = auth.uid()
$$;

-- =============================================================================
-- 2. places — POI (공개 읽기)
-- =============================================================================
create table public.places (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  name_i18n       jsonb default '{}'::jsonb,        -- {en, zh-CN, zh-TW, ja, ko}
  category        text,
  address         text,
  lat             double precision,
  lng             double precision,
  google_place_id text,
  naver_place_id  text,
  description_i18n jsonb default '{}'::jsonb,
  tags            text[] default '{}',
  image_url       text,
  source          place_source not null default 'curated',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_places_category on public.places(category);
create index idx_places_source   on public.places(source);

-- =============================================================================
-- 3. partners — 제휴 업체
-- =============================================================================
create table public.partners (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  contact         text,
  place_id        uuid references public.places(id) on delete set null,
  settlement_info jsonb default '{}'::jsonb,        -- 정산 정보 (민감 — 공개 노출 금지)
  status          partner_status not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_partners_place_id on public.partners(place_id);

-- =============================================================================
-- 4. coupons — 외국인 전용 쿠폰 (공개 읽기)
-- =============================================================================
create table public.coupons (
  id                  uuid primary key default gen_random_uuid(),
  title_i18n          jsonb not null default '{}'::jsonb,
  partner_id          uuid references public.partners(id) on delete cascade,
  discount_type       coupon_discount_type not null,
  discount_value      numeric,                      -- freebie 의 경우 null 가능
  valid_from          timestamptz,
  valid_until         timestamptz,
  usage_condition_i18n jsonb default '{}'::jsonb,
  place_id            uuid references public.places(id) on delete set null,
  status              coupon_status not null default 'active',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_coupons_partner_id on public.coupons(partner_id);
create index idx_coupons_place_id   on public.coupons(place_id);
create index idx_coupons_status     on public.coupons(status);

-- =============================================================================
-- 5. coupon_issues — 발급 쿠폰 (one-time QR token, TTL 5분)
--    발급/검증/소멸은 Edge Function(service role) 전용 — 클라이언트는 본인 것 read 만
-- =============================================================================
create table public.coupon_issues (
  id            uuid primary key default gen_random_uuid(),
  coupon_id     uuid not null references public.coupons(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  qr_token      text not null unique default gen_random_uuid()::text,  -- one-time token
  issued_at     timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '5 minutes'),  -- TTL 5분
  used_at       timestamptz,
  used_location jsonb,                              -- {lat, lng}
  status        coupon_issue_status not null default 'issued',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_coupon_issues_user_id   on public.coupon_issues(user_id);
create index idx_coupon_issues_coupon_id on public.coupon_issues(coupon_id);
create index idx_coupon_issues_qr_token  on public.coupon_issues(qr_token);

-- =============================================================================
-- 6. tickets — 티켓 (공개 읽기, 초기 아웃링크)
-- =============================================================================
create table public.tickets (
  id          uuid primary key default gen_random_uuid(),
  title_i18n  jsonb not null default '{}'::jsonb,
  category    text,
  price       numeric,
  currency    text default 'KRW',
  provider_id uuid references public.partners(id) on delete set null,
  outlink_url text,
  qr_voucher  text,
  status      ticket_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_tickets_provider_id on public.tickets(provider_id);
create index idx_tickets_status      on public.tickets(status);

-- =============================================================================
-- 7. ai_chat_logs — AI 깐부 대화 로그 (본인 데이터)
-- =============================================================================
create table public.ai_chat_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  language         text,
  question         text,
  answer_summary   text,
  location_context jsonb,                           -- {lat, lng, region}
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_ai_chat_logs_user_id on public.ai_chat_logs(user_id);

-- =============================================================================
-- 8. favorites — 즐겨찾기 (본인 데이터)
-- =============================================================================
create table public.favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  place_id   uuid references public.places(id) on delete cascade,
  type       favorite_type not null default 'place',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, place_id, type)
);

create index idx_favorites_user_id on public.favorites(user_id);

-- =============================================================================
-- 9. itineraries — 여행 일정 (본인 데이터)
-- =============================================================================
create table public.itineraries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  title      text,
  region     text,
  duration   text,                                  -- 3h | half-day | 1day ...
  items      jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_itineraries_user_id on public.itineraries(user_id);

-- =============================================================================
-- 10. emergency_phrases — 긴급 회화 (공개 읽기)
-- =============================================================================
create table public.emergency_phrases (
  id           uuid primary key default gen_random_uuid(),
  category     text,
  source_text  text not null,
  translations jsonb default '{}'::jsonb,           -- {en, zh-CN, zh-TW, ja, ko}
  priority     integer default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_emergency_phrases_priority on public.emergency_phrases(priority);

-- =============================================================================
-- updated_at 자동 트리거 (전 테이블)
-- =============================================================================
create trigger trg_users_updated_at             before update on public.users             for each row execute function public.set_updated_at();
create trigger trg_places_updated_at            before update on public.places            for each row execute function public.set_updated_at();
create trigger trg_partners_updated_at          before update on public.partners          for each row execute function public.set_updated_at();
create trigger trg_coupons_updated_at           before update on public.coupons           for each row execute function public.set_updated_at();
create trigger trg_coupon_issues_updated_at     before update on public.coupon_issues     for each row execute function public.set_updated_at();
create trigger trg_tickets_updated_at           before update on public.tickets           for each row execute function public.set_updated_at();
create trigger trg_ai_chat_logs_updated_at      before update on public.ai_chat_logs      for each row execute function public.set_updated_at();
create trigger trg_favorites_updated_at         before update on public.favorites         for each row execute function public.set_updated_at();
create trigger trg_itineraries_updated_at       before update on public.itineraries       for each row execute function public.set_updated_at();
create trigger trg_emergency_phrases_updated_at before update on public.emergency_phrases for each row execute function public.set_updated_at();

-- =============================================================================
-- auth.users INSERT → public.users 자동 생성 트리거
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (auth_id, email, provider)
  values (
    new.id,
    new.email,
    coalesce(new.raw_app_meta_data->>'provider', 'anonymous')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- RLS 활성화
-- =============================================================================
alter table public.users             enable row level security;
alter table public.places            enable row level security;
alter table public.partners          enable row level security;
alter table public.coupons           enable row level security;
alter table public.coupon_issues     enable row level security;
alter table public.tickets           enable row level security;
alter table public.ai_chat_logs      enable row level security;
alter table public.favorites         enable row level security;
alter table public.itineraries       enable row level security;
alter table public.emergency_phrases enable row level security;

-- -----------------------------------------------------------------------------
-- users — 본인 데이터만
-- -----------------------------------------------------------------------------
create policy "users_select_own" on public.users
  for select using (auth_id = auth.uid());
create policy "users_update_own" on public.users
  for update using (auth_id = auth.uid()) with check (auth_id = auth.uid());

-- -----------------------------------------------------------------------------
-- places — 공개 읽기 (쓰기는 service role 전용)
-- -----------------------------------------------------------------------------
create policy "places_select_public" on public.places
  for select using (true);

-- -----------------------------------------------------------------------------
-- partners — 활성 파트너 공개 읽기
-- 주의: settlement_info(정산정보)는 민감 컬럼 → 클라이언트엔 안전 컬럼만 노출하는
--       view 를 별도 구성 권장. 쓰기는 service role 전용.
-- -----------------------------------------------------------------------------
create policy "partners_select_active" on public.partners
  for select using (status = 'active');

-- -----------------------------------------------------------------------------
-- coupons — 활성 쿠폰 공개 읽기 (쓰기는 service role 전용)
-- -----------------------------------------------------------------------------
create policy "coupons_select_active" on public.coupons
  for select using (status = 'active');

-- -----------------------------------------------------------------------------
-- coupon_issues — 본인 발급분 read 만. 발급/검증/소멸은 Edge Function(service role)
-- service role 은 RLS 우회하므로 별도 insert/update 정책 두지 않음 (부정사용 방지)
-- -----------------------------------------------------------------------------
create policy "coupon_issues_select_own" on public.coupon_issues
  for select using (user_id = public.current_user_id());

-- -----------------------------------------------------------------------------
-- tickets — 공개 읽기 (쓰기는 service role 전용)
-- -----------------------------------------------------------------------------
create policy "tickets_select_public" on public.tickets
  for select using (true);

-- -----------------------------------------------------------------------------
-- ai_chat_logs — 본인 데이터
-- -----------------------------------------------------------------------------
create policy "ai_chat_logs_select_own" on public.ai_chat_logs
  for select using (user_id = public.current_user_id());
create policy "ai_chat_logs_insert_own" on public.ai_chat_logs
  for insert with check (user_id = public.current_user_id());

-- -----------------------------------------------------------------------------
-- favorites — 본인 데이터
-- -----------------------------------------------------------------------------
create policy "favorites_select_own" on public.favorites
  for select using (user_id = public.current_user_id());
create policy "favorites_insert_own" on public.favorites
  for insert with check (user_id = public.current_user_id());
create policy "favorites_delete_own" on public.favorites
  for delete using (user_id = public.current_user_id());

-- -----------------------------------------------------------------------------
-- itineraries — 본인 데이터
-- -----------------------------------------------------------------------------
create policy "itineraries_select_own" on public.itineraries
  for select using (user_id = public.current_user_id());
create policy "itineraries_insert_own" on public.itineraries
  for insert with check (user_id = public.current_user_id());
create policy "itineraries_update_own" on public.itineraries
  for update using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());
create policy "itineraries_delete_own" on public.itineraries
  for delete using (user_id = public.current_user_id());

-- -----------------------------------------------------------------------------
-- emergency_phrases — 공개 읽기 (쓰기는 service role 전용)
-- -----------------------------------------------------------------------------
create policy "emergency_phrases_select_public" on public.emergency_phrases
  for select using (true);
