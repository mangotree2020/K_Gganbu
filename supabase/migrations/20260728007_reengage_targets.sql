-- 귀국 후 리인게이지먼트 대상 조회 (PRD REQ-KL-5)
-- BM 스토리 C: 여행이 끝나면 앱을 열 이유가 사라진다 → 챌린지를 하던 사용자가 며칠 조용해지면
--   "연속 기록이 끊기기 전에 돌아오라"는 알림이 재방문 트리거가 된다.
--
-- 자동 발송이 아니라 **대상 조회**만 제공하는 이유:
--   ① 이 프로젝트에는 pg_net 이 설치돼 있지 않아 DB에서 직접 HTTP(push-send) 호출이 불가능하다.
--   ② 실사용자에게 나가는 알림은 운영자가 문안·시점을 보고 보내는 편이 초기 단계에 안전하다.
--   자동화하려면 pg_net 설치 후 cron.schedule 로 push-send 를 호출하면 된다(SETUP_EXTERNAL 참조).
-- 개인정보: 이메일·이름을 반환하지 않는다(user_id·기록 지표만).

create or replace function public.reengage_targets(
  p_min_days integer default 3,   -- 이 일수 이상 조용한 사용자
  p_max_days integer default 60,  -- 너무 오래된 이탈자는 제외
  p_limit integer default 50
)
returns table (
  user_id     uuid,
  last_done   date,
  days_since  integer,
  streak_days bigint,
  device_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with last as (
    select cd.user_id, max(cd.day) as last_done, count(*)::bigint as streak_days
    from challenge_days cd
    group by cd.user_id
  )
  select l.user_id,
    l.last_done,
    ((now() at time zone 'Asia/Seoul')::date - l.last_done)::integer as days_since,
    l.streak_days,
    (select count(*)::bigint from device_tokens dt where dt.user_id = l.user_id) as device_count
  from last l
  where ((now() at time zone 'Asia/Seoul')::date - l.last_done)
        between greatest(p_min_days, 1) and greatest(p_max_days, 1)
    -- 보낼 기기가 있는 사용자만 (알림 opt-in 한 사람)
    and exists (select 1 from device_tokens dt where dt.user_id = l.user_id)
  order by l.streak_days desc, l.last_done desc
  limit greatest(p_limit, 1)
$$;

-- 운영 도구 전용 — 앱 클라이언트는 호출할 수 없다(Admin Edge Function 이 service role 로 호출)
revoke all on function public.reengage_targets(integer, integer, integer) from public, anon, authenticated;
