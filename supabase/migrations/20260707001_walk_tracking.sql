-- 이동 트래킹 (PRD REQ-LOC — 길찾기 이동 기록·걷기 랭킹·위치 핑)
-- 설계 원칙:
--   · walk_journeys: 길찾기 중 이동 경로 요약(거리·시간·다운샘플 경로) — 사용자간 이동거리 랭킹 원천
--     차량 어뷰징 1차 차단: 평균 속도 12km/h 이하만 저장 허용(DB check)
--   · location_pings: 앱 사용 중 10분 간격 위치 — 위치기반 이벤트(지오펜스 쿠폰 푸시 등) 데이터화
--     개인정보 최소화: 본인만 조회(RLS), 보관 90일 자동 삭제(pg_cron), 좌표+정확도만 저장
--   · 랭킹 공개는 walk_rank() 함수로만 — 닉네임 마스킹·집계값만 노출, 개인 경로·위치는 비공개

-- =============================================================================
-- 1. walk_journeys — 길찾기 이동 기록
-- =============================================================================
create table public.walk_journeys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  started_at   timestamptz not null,
  ended_at     timestamptz not null,
  distance_m   integer not null check (distance_m between 0 and 100000),
  duration_ms  bigint not null check (duration_ms > 0),
  path         jsonb not null default '[]'::jsonb,  -- 다운샘플 [{lat,lng}] 최대 ~200점
  created_at   timestamptz not null default now(),
  check (ended_at > started_at),
  -- 평균 속도 ≤ 12km/h (도보·러닝 상한) — 차량 이동 기록 차단
  check (distance_m::numeric / greatest(duration_ms / 1000.0, 1) <= 3.4)
);

create index idx_walk_journeys_user on public.walk_journeys (user_id, created_at desc);
create index idx_walk_journeys_rank on public.walk_journeys (created_at, user_id);

alter table public.walk_journeys enable row level security;

create policy "walk_journeys_select_own" on public.walk_journeys
  for select using (user_id = public.current_user_id());
create policy "walk_journeys_insert_own" on public.walk_journeys
  for insert with check (user_id = public.current_user_id());

-- =============================================================================
-- 2. location_pings — 앱 사용 중 10분 간격 위치 (위치기반 이벤트 데이터)
-- =============================================================================
create table public.location_pings (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  lat        double precision not null,
  lng        double precision not null,
  accuracy   real,
  created_at timestamptz not null default now()
);

create index idx_location_pings_user on public.location_pings (user_id, created_at desc);
create index idx_location_pings_purge on public.location_pings (created_at);

alter table public.location_pings enable row level security;

create policy "location_pings_select_own" on public.location_pings
  for select using (user_id = public.current_user_id());
create policy "location_pings_insert_own" on public.location_pings
  for insert with check (user_id = public.current_user_id());

-- 보관 90일 자동 삭제 — 개인정보 보관기한 (매일 KST 00:30)
select cron.schedule(
  'purge-location-pings',
  '30 15 * * *',
  $$delete from public.location_pings where created_at < now() - interval '90 days'$$
);

-- =============================================================================
-- 3. walk_rank — 이동거리 랭킹 (기간 내 합계, 상위 20 + 내 순위)
--    security definer 로 RLS 우회하되 닉네임 마스킹·집계값만 반환 (개인 위치 비노출)
-- =============================================================================
create or replace function public.walk_rank(p_days integer default 7)
returns table (
  rank bigint,
  display_name text,
  total_m bigint,
  journeys bigint,
  is_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with sums as (
    select w.user_id,
      sum(w.distance_m)::bigint as total_m,
      count(*)::bigint as journeys
    from walk_journeys w
    where w.created_at >= now() - make_interval(days => greatest(p_days, 1))
    group by w.user_id
  ),
  ranked as (
    select s.*,
      rank() over (order by s.total_m desc) as rnk,
      -- 닉네임 마스킹: 앞 1글자 + ** (소스: auth 메타데이터 full_name → 이메일 앞부분 → Traveler)
      case
        when coalesce(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1), '') <> ''
          then left(coalesce(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)), 1) || '**'
        else 'Traveler'
      end as dname,
      (s.user_id = current_user_id()) as me
    from sums s
    join users u on u.id = s.user_id
    left join auth.users au on au.id = u.auth_id
  )
  select rnk, dname, total_m, journeys, me
  from ranked
  where rnk <= 20 or me
  order by rnk
$$;

-- 랭킹은 로그인·게스트 모두 조회 가능 (집계·마스킹 데이터만)
grant execute on function public.walk_rank(integer) to authenticated;
revoke all on function public.walk_rank(integer) from public, anon;
