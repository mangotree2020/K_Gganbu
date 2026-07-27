-- 걸음수 신뢰 검증 (PRD REQ-PD-2 잔여 — verified_steps)
-- 걸음수는 클라이언트 신고 값이라 서버가 직접 셀 수 없다. 대신 **이미 수집 중인 이동 데이터**
--   (foreground 위치 핑·길찾기 경로)와 대조해 "움직인 흔적이 있는가"를 본다.
--
-- 설계 원칙: 정상 사용자를 벌하지 않는다.
--   ① 위치 권한을 껐거나 실내에서만 걸은 사용자는 이동 데이터가 비어 있을 수 있다 →
--      **그 자체로는 차감하지 않는다**. 일 상한(100P)이 이미 손실의 상한이다.
--   ② 다만 "움직인 흔적이 전혀 없는데 극단적 걸음수"는 흔들기·자동화 신호이므로 clamp 한다.
--   ③ 판정 결과는 원장 meta 에 남겨 이후 정책(임계값 조정)을 데이터로 결정할 수 있게 한다.

create or replace function public.step_corroboration(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    -- 오늘(KST) 위치 핑 수 — 앱을 켜고 돌아다닌 흔적
    'pings', (
      select count(*) from location_pings
      where user_id = p_user
        and (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
    ),
    -- 오늘 길찾기로 기록된 이동 거리(m)
    'journey_m', coalesce((
      select sum(distance_m) from walk_journeys
      where user_id = p_user
        and (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
    ), 0)
  )
$$;

revoke all on function public.step_corroboration(uuid) from public, anon, authenticated;
