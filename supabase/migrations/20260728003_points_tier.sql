-- 깐부 등급 (PRD REQ-PT-3, BM§3.5 / BM§5 S-6)
-- 누적 적립 포인트 + 여행 횟수로 4단계. 혜택은 ① 적립 부스트 ② 기프티콘 포인트 사용 상한 상향.
--
-- 부채 가드레일 (중요): 부스트는 **일 상한을 올리지 않는다**.
--   earn_points 는 부스트를 적용한 뒤에도 적립원별 일 상한으로 클램프하므로,
--   상위 등급 사용자는 "상한에 더 빨리 도달"할 뿐 하루 발행 총량은 그대로다(BM§3.5 발행 캡 유지).
--
-- 여행 횟수 정의: 적립 활동일(KST)을 30일 이상 공백으로 끊어 센 구간 수.
--   "재방문 여행자"를 코드로 판정할 유일한 서버 근거가 적립 활동 이력이라 이를 프록시로 쓴다.
--   (체크인·항공권 데이터가 생기면 그때 정의를 교체할 것 — 등급 계산은 이 함수 하나에만 있다)

create or replace function public.user_tier(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lifetime integer;
  v_trips    integer;
  v_tier     text;
  v_boost    integer;   -- 적립 부스트 %
  v_rate     integer;   -- 기프티콘 포인트 사용 상한 %
  v_next     text;
  v_need     integer;   -- 다음 등급까지 남은 누적 포인트 (최고 등급이면 0)
begin
  select coalesce(sum(amount), 0)::integer into v_lifetime
  from points_ledger where user_id = p_user and kind in ('earn', 'revert');

  -- 활동일을 30일 공백 기준으로 묶어 여행 횟수 산정
  with days as (
    select distinct (created_at at time zone 'Asia/Seoul')::date as d
    from points_ledger where user_id = p_user and kind = 'earn'
  ),
  gaps as (
    select d, case when d - lag(d) over (order by d) > 30 or lag(d) over (order by d) is null
                   then 1 else 0 end as is_new
    from days
  )
  select coalesce(sum(is_new), 0)::integer into v_trips from gaps;

  -- 등급 — 누적 포인트 또는 여행 횟수 중 하나만 충족해도 승급(재방문 우대)
  if v_lifetime >= 5000 or v_trips >= 5 then
    v_tier := 'gganbu'; v_boost := 20; v_rate := 50; v_next := null; v_need := 0;
  elsif v_lifetime >= 2000 or v_trips >= 3 then
    v_tier := 'bestie'; v_boost := 10; v_rate := 40; v_next := 'gganbu'; v_need := greatest(5000 - v_lifetime, 0);
  elsif v_lifetime >= 500 or v_trips >= 2 then
    v_tier := 'friend'; v_boost := 5; v_rate := 35; v_next := 'bestie'; v_need := greatest(2000 - v_lifetime, 0);
  else
    v_tier := 'seed'; v_boost := 0; v_rate := 30; v_next := 'friend'; v_need := greatest(500 - v_lifetime, 0);
  end if;

  return jsonb_build_object(
    'tier', v_tier,
    'lifetime', v_lifetime,
    'trips', v_trips,
    'boost_pct', v_boost,
    'gifticon_rate_pct', v_rate,
    'next_tier', v_next,
    'next_need', v_need
  );
end;
$$;

revoke all on function public.user_tier(uuid) from public, anon, authenticated;

-- earn_points — 등급 부스트 적용(상한 클램프는 그대로). admin 수동 지급은 부스트 제외.
create or replace function public.earn_points(
  p_user uuid,
  p_source text,
  p_amount integer,
  p_idem text,
  p_ref uuid default null,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap integer;
  v_group text[];
  v_today integer;
  v_grant integer;
  v_boost integer := 0;
  v_base integer;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  case p_source
    when 'steps' then v_cap := 100; v_group := array['steps'];
    when 'stamp' then v_cap := 150; v_group := array['stamp'];
    when 'stamp_card' then v_cap := 200; v_group := array['stamp_card'];
    when 'challenge' then v_cap := 30; v_group := array['challenge', 'game'];
    when 'game' then v_cap := 30; v_group := array['challenge', 'game'];
    when 'admin' then v_cap := null; v_group := null;
    else return jsonb_build_object('ok', false, 'error', 'invalid_source');
  end case;

  if exists (select 1 from points_ledger where idempotency_key = p_idem) then
    return jsonb_build_object('ok', true, 'granted', 0, 'duplicate', true,
      'balance', points_balance_of(p_user));
  end if;

  perform pg_advisory_xact_lock(hashtext('points:' || p_user::text));

  -- 등급 부스트 (REQ-PT-3) — 운영 수동 지급(admin)은 제외. 상한은 아래에서 그대로 적용.
  v_base := p_amount;
  if p_source <> 'admin' then
    v_boost := coalesce((user_tier(p_user)->>'boost_pct')::integer, 0);
    if v_boost > 0 then
      p_amount := p_amount + (p_amount * v_boost / 100);
    end if;
  end if;

  if v_cap is not null then
    select coalesce(sum(amount), 0) into v_today
    from points_ledger
    where user_id = p_user and kind = 'earn' and source = any(v_group)
      and (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date;
    v_grant := least(p_amount, greatest(v_cap - v_today, 0));
  else
    v_grant := p_amount;
  end if;

  if v_grant <= 0 then
    return jsonb_build_object('ok', true, 'granted', 0, 'capped', true,
      'balance', points_balance_of(p_user));
  end if;

  insert into points_ledger (user_id, kind, source, amount, remaining, expires_at, idempotency_key, ref_id, meta)
  values (p_user, 'earn', p_source, v_grant, v_grant, now() + interval '180 days', p_idem, p_ref,
          case when v_boost > 0 then p_meta || jsonb_build_object('boost_pct', v_boost, 'base', v_base)
               else p_meta end);

  return jsonb_build_object('ok', true, 'granted', v_grant, 'capped', v_grant < p_amount,
    'boost_pct', v_boost, 'balance', points_balance_of(p_user));
end;
$$;

revoke all on function public.earn_points(uuid, text, integer, text, uuid, jsonb) from public, anon, authenticated;
