-- 주간 걷기 랭킹 보상 (REQ-LOC-5) — 지난 7일 이동거리 상위 3명에게 30/20/10P.
-- 매주 월요일 KST 00:20 배치. source='challenge'(일 30P 서버 캡과 정합, 주 1회라 캡 내).
-- 멱등: walkrank:{ISO주차}:{user} — 배치가 중복 실행돼도 이중 지급 없음.
create or replace function public.award_walk_rank()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  rank_no integer := 0;
  awarded integer := 0;
  amounts integer[] := array[30, 20, 10];
  wk text := to_char(now() at time zone 'Asia/Seoul', 'IYYY-IW');
begin
  for rec in
    select w.user_id, sum(w.distance_m)::bigint as total_m
    from walk_journeys w
    where w.created_at >= now() - interval '7 days'
    group by w.user_id
    order by total_m desc
    limit 3
  loop
    rank_no := rank_no + 1;
    perform earn_points(
      rec.user_id,
      'challenge',
      amounts[rank_no],
      'walkrank:' || wk || ':' || rec.user_id,
      null,
      jsonb_build_object('rank', rank_no, 'total_m', rec.total_m, 'kind', 'walk_rank')
    );
    awarded := awarded + 1;
  end loop;
  return awarded;
end;
$$;

revoke all on function public.award_walk_rank() from public, anon, authenticated;

-- UTC 일요일 15:20 = KST 월요일 00:20
select cron.schedule('award-walk-rank-weekly', '20 15 * * 0', $$select public.award_walk_rank()$$);
