-- 게임 점수·지역 랭킹·뱃지 (PRD REQ-GM-2, BM§5 S-3)
-- "부산에서 플레이한 사람끼리 겨룬다"가 여행 맥락의 핵심이라 지역(region)을 함께 기록한다.
--
-- 신뢰 경계: 점수는 클라이언트 신고 값이다. 포인트 적립은 이미 서버가 상한으로 캡하므로
--   (earn_game, 일 30P) 점수 조작으로 얻을 수 있는 것은 "랭킹 표시"뿐이다.
--   그래도 무한대 값이 랭킹을 망치지 않도록 상한 체크를 DB에 둔다(walk_journeys 속도 체크와 같은 취지).
-- 노출 원칙: 랭킹은 집계·마스킹 닉네임만 공개(walk_rank 와 동일), 개인 점수 행은 본인만 조회.

create table public.game_scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  game       text not null check (game in ('tetris', 'rps')),
  score      integer not null check (score >= 0 and score <= 1000000),
  region     text,                                   -- 'busan' 등 (온보딩 travel_region)
  created_at timestamptz not null default now()
);

create index idx_game_scores_rank on public.game_scores (game, created_at desc, score desc);
create index idx_game_scores_user on public.game_scores (user_id, created_at desc);

alter table public.game_scores enable row level security;

-- 본인 점수만 기록·조회 (랭킹은 아래 security definer 함수로만 노출)
create policy "game_scores_insert_own" on public.game_scores
  for insert with check (user_id = public.current_user_id());

create policy "game_scores_select_own" on public.game_scores
  for select using (user_id = public.current_user_id());

-- =============================================================================
-- game_rank — 게임별·지역별 랭킹 (기간 내 개인 최고점 기준)
--   p_region 이 null 이면 전체. 마스킹 닉네임·집계만 반환한다.
-- =============================================================================
create or replace function public.game_rank(
  p_game text default 'tetris',
  p_days integer default 7,
  p_region text default null
)
returns table (
  rank bigint,
  display_name text,
  best_score integer,
  plays bigint,
  is_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with bests as (
    select g.user_id,
      max(g.score) as best_score,
      count(*)::bigint as plays
    from game_scores g
    where g.game = p_game
      and g.created_at >= now() - make_interval(days => greatest(p_days, 1))
      and (p_region is null or g.region = p_region)
    group by g.user_id
  ),
  ranked as (
    select b.*,
      rank() over (order by b.best_score desc) as rnk,
      -- 닉네임 마스킹 (walk_rank 와 동일 규칙)
      case
        when coalesce(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1), '') <> ''
          then left(coalesce(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)), 1) || '**'
        else 'Traveler'
      end as dname,
      (b.user_id = current_user_id()) as me
    from bests b
    join users u on u.id = b.user_id
    left join auth.users au on au.id = u.auth_id
  )
  select rnk, dname, best_score, plays, me
  from ranked
  where rnk <= 20 or me
  order by rnk
$$;

-- =============================================================================
-- game_badges — 누적 성과 뱃지 (REQ-GM-2)
--   별도 테이블 없이 game_scores 집계로 산정한다: 뱃지는 "지금까지의 기록"의 표현일 뿐이라
--   따로 저장하면 원장(점수)과 어긋날 여지만 생긴다.
-- =============================================================================
-- 본인 것만 계산한다(파라미터로 남의 id를 넣어 훔쳐볼 수 없도록 current_user_id 고정)
create or replace function public.game_badges()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select
      count(*) filter (where game = 'tetris') as tetris_plays,
      coalesce(max(score) filter (where game = 'tetris'), 0) as tetris_best,
      count(*) filter (where game = 'rps') as rps_wins
    from game_scores where user_id = current_user_id()
  )
  select jsonb_build_object(
    'tetris_plays', s.tetris_plays,
    'tetris_best', s.tetris_best,
    'rps_wins', s.rps_wins,
    'badges', (
      select coalesce(jsonb_agg(b), '[]'::jsonb) from (
        select 'first_play' as b where s.tetris_plays + s.rps_wins > 0
        union all select 'tetris_10' where s.tetris_plays >= 10
        union all select 'tetris_100pt' where s.tetris_best >= 100
        union all select 'rps_master' where s.rps_wins >= 10
      ) t
    )
  ) from s
$$;

revoke all on function public.game_badges() from public, anon;
grant execute on function public.game_badges() to authenticated;
