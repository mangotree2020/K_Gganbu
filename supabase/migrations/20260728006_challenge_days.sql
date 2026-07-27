-- 챌린지 학습 진도 서버 동기화 (PRD REQ-KL-2)
-- 왜 별도 테이블인가: 진도를 points_ledger 로 유도하면 "상한에 걸려 0P 적립된 날"이 누락돼
--   연속 기록이 끊긴다(게임으로 일 상한 30P를 이미 채운 날). 학습 완주 사실과 보상 지급은
--   별개 사건이므로 완주일을 따로 남긴다.
-- 신뢰: 기록은 Edge Function(service role) 전용 — 클라이언트가 연속일을 조작할 수 없다.

create table public.challenge_days (
  user_id uuid not null references public.users(id) on delete cascade,
  day     date not null,                      -- KST 기준 완주일
  primary key (user_id, day)
);

create index idx_challenge_days_user on public.challenge_days (user_id, day desc);

alter table public.challenge_days enable row level security;

-- 본인 기록 읽기만 (쓰기 정책 없음 = service role 전용)
create policy "challenge_days_select_own" on public.challenge_days
  for select using (user_id = public.current_user_id());

-- =============================================================================
-- challenge_stats — 연속 출석·최고 기록·누적 완주일 (본인 고정)
--   streak: 오늘(또는 어제)까지 이어진 연속 일수. 어제까지면 오늘 하면 이어진다는 뜻이라 유지.
-- =============================================================================
create or replace function public.challenge_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user  uuid := current_user_id();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_last  date;
  v_streak integer := 0;
  v_best   integer := 0;
  v_total  integer := 0;
  v_run    integer := 0;
  v_prev   date;
  r record;
begin
  if v_user is null then
    return jsonb_build_object('streak', 0, 'best_streak', 0, 'total_days', 0, 'last_done', null)
    ;
  end if;

  select count(*), max(day) into v_total, v_last from challenge_days where user_id = v_user;
  if v_total = 0 then
    return jsonb_build_object('streak', 0, 'best_streak', 0, 'total_days', 0, 'last_done', null);
  end if;

  -- 전체 일자를 훑어 최장 연속(best)과 현재 연속(streak)을 함께 구한다
  for r in select day from challenge_days where user_id = v_user order by day loop
    if v_prev is null or r.day - v_prev > 1 then
      v_run := 1;
    else
      v_run := v_run + 1;
    end if;
    v_prev := r.day;
    if v_run > v_best then v_best := v_run; end if;
  end loop;

  -- 마지막 완주일이 오늘/어제면 현재 연속으로 인정, 그보다 오래됐으면 끊긴 것
  if v_last >= v_today - 1 then
    v_streak := v_run;
  else
    v_streak := 0;
  end if;

  return jsonb_build_object(
    'streak', v_streak,
    'best_streak', v_best,
    'total_days', v_total,
    'last_done', v_last
  );
end;
$$;

revoke all on function public.challenge_stats() from public, anon;
grant execute on function public.challenge_stats() to authenticated;
