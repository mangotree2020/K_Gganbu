-- 백오피스 집계 (PRD REQ-BO-2) — 역할별 대시보드가 쓰는 지표를 **서버 한 곳**에서 계산한다.
-- 화면이 각자 계산하면 같은 지표가 화면마다 다른 값을 내고, 그 순간 대시보드는 신뢰를 잃는다.
--
-- 개인정보: 응답에 사용자 id·이메일을 포함하지 않는다(집계·건수만).
-- 권한: service role 전용(백오피스 Edge Function 이 관리자 게이트를 통과한 뒤 호출).

-- ── 1. 경영 요약 (사장) ─────────────────────────────────────────────────────
create or replace function public.bo_overview(p_days integer default 7)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with win as (select now() - make_interval(days => greatest(p_days, 1)) as since),
  issued as (
    select count(*) as n from coupon_issues, win where issued_at >= win.since
  ),
  used as (
    select count(*) as n from coupon_issues, win where used_at >= win.since
  ),
  -- 여행 1건당 사용 건수의 프록시: 기간 내 활동 사용자 대비 사용 건수 (BM§7 북극성)
  actives as (
    select count(distinct user_id) as n from analytics_events, win where created_at >= win.since
  ),
  newbies as (
    select count(*) as n from users, win where created_at >= win.since
  ),
  ai as (
    select count(*) as n from analytics_events, win
    where event = 'ai_ask' and created_at >= win.since
  ),
  debt as (
    -- 포인트 부채 = 미사용·미소멸 잔액 합 (BM§3.5 발행 원가 리스크)
    select coalesce(sum(remaining), 0)::bigint as p
    from points_ledger where remaining > 0 and expires_at > now()
  ),
  issued_today as (
    select coalesce(sum(amount), 0)::bigint as p
    from points_ledger
    where kind = 'earn'
      and (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
  )
  select jsonb_build_object(
    'days', greatest(p_days, 1),
    'active_users', (select n from actives),
    'new_users', (select n from newbies),
    'coupons_issued', (select n from issued),
    'coupons_used', (select n from used),
    'use_rate', case when (select n from issued) > 0
                     then round((select n from used)::numeric * 100 / (select n from issued), 1)
                     else 0 end,
    -- 북극성 프록시: 활동 사용자 1인당 사용 건수
    'uses_per_active', case when (select n from actives) > 0
                            then round((select n from used)::numeric / (select n from actives), 2)
                            else 0 end,
    'ai_asks', (select n from ai),
    'points_debt', (select p from debt),
    'points_issued_today', (select p from issued_today)
  )
$$;

-- ── 2. 전환 퍼널 + 기능 사용량 (PO) ────────────────────────────────────────
create or replace function public.bo_product(p_days integer default 7)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with win as (select now() - make_interval(days => greatest(p_days, 1)) as since),
  ev as (
    select event, count(*)::bigint as n
    from analytics_events, win where created_at >= win.since group by event
  ),
  used as (select count(*)::bigint as n from coupon_issues, win where used_at >= win.since)
  select jsonb_build_object(
    'funnel', jsonb_build_array(
      jsonb_build_object('step', 'list_view', 'n', coalesce((select n from ev where event='coupon_list_view'), 0)),
      jsonb_build_object('step', 'tap',       'n', coalesce((select n from ev where event='coupon_tap'), 0)),
      jsonb_build_object('step', 'qr_issued', 'n', coalesce((select n from ev where event='coupon_qr_issued'), 0)),
      jsonb_build_object('step', 'used',      'n', (select n from used))
    ),
    'events', coalesce((select jsonb_object_agg(event, n) from ev), '{}'::jsonb),
    'features', jsonb_build_object(
      'stamp_visits', (select count(*) from stamp_visits, win where created_at >= win.since),
      'challenge_days', (select count(*) from challenge_days, win where day >= (win.since at time zone 'Asia/Seoul')::date),
      'game_plays', (select count(*) from game_scores, win where created_at >= win.since),
      'reviews', (select count(*) from reviews, win where created_at >= win.since),
      'walk_journeys', (select count(*) from walk_journeys, win where created_at >= win.since)
    ),
    'open_reports', (select count(*) from content_reports where status = 'open')
  )
$$;

-- ── 3. 딜 성과·인벤토리 (MD) ───────────────────────────────────────────────
create or replace function public.bo_merchandising(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with win as (select now() - make_interval(days => greatest(p_days, 1)) as since),
  deals as (
    select c.id,
      coalesce(c.title_i18n->>'ko', c.title_i18n->>'en', c.id::text) as title,
      c.category,
      p.name as partner,
      (select count(*) from coupon_issues i, win where i.coupon_id = c.id and i.issued_at >= win.since) as issued,
      (select count(*) from coupon_issues i, win where i.coupon_id = c.id and i.used_at >= win.since) as used
    from coupons c left join partners p on p.id = c.partner_id
    where c.status = 'active'
  )
  select jsonb_build_object(
    'partners_total', (select count(*) from partners where status = 'active'),
    'partners_without_coords', (select count(*) from partners where status = 'active' and (lat is null or lng is null)),
    'coupons_active', (select count(*) from coupons where status = 'active'),
    'by_category', coalesce((
      select jsonb_object_agg(coalesce(category, 'etc'), n)
      from (select category, count(*)::bigint as n from coupons where status='active' group by category) t
    ), '{}'::jsonb),
    'deals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', title, 'partner', partner, 'category', category,
        'issued', issued, 'used', used,
        'use_rate', case when issued > 0 then round(used::numeric * 100 / issued, 1) else 0 end
      ) order by used desc, issued desc)
      from deals
    ), '[]'::jsonb)
  )
$$;

-- ── 4. 채널·유입 (마케팅) ──────────────────────────────────────────────────
create or replace function public.bo_growth(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with win as (select now() - make_interval(days => greatest(p_days, 1)) as since)
  select jsonb_build_object(
    'channels', coalesce((
      select jsonb_agg(jsonb_build_object('ch', ch, 'visits', n) order by n desc)
      from (
        select coalesce(nullif(ch, ''), '(direct)') as ch, count(*)::bigint as n
        from landing_events, win where created_at >= win.since group by 1
      ) t
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_object_agg(coalesce(platform, 'unknown'), n)
      from (select platform, count(*)::bigint as n from device_tokens group by platform) d
    ), '{}'::jsonb),
    'ticket_outlinks', (select count(*) from analytics_events, win
                        where event = 'ticket_outlink' and created_at >= win.since)
  )
$$;

-- ── 5. 일별 시계열 (데이터) ────────────────────────────────────────────────
create or replace function public.bo_timeseries(p_days integer default 14)
returns table (day date, events bigint, issued bigint, used bigint, points bigint)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select generate_series(
      (now() at time zone 'Asia/Seoul')::date - (greatest(p_days, 1) - 1),
      (now() at time zone 'Asia/Seoul')::date,
      interval '1 day'
    )::date as day
  )
  select d.day,
    (select count(*) from analytics_events a
       where (a.created_at at time zone 'Asia/Seoul')::date = d.day)::bigint,
    (select count(*) from coupon_issues i
       where (i.issued_at at time zone 'Asia/Seoul')::date = d.day)::bigint,
    (select count(*) from coupon_issues i
       where (i.used_at at time zone 'Asia/Seoul')::date = d.day)::bigint,
    (select coalesce(sum(amount), 0) from points_ledger l
       where l.kind = 'earn' and (l.created_at at time zone 'Asia/Seoul')::date = d.day)::bigint
  from days d order by d.day
$$;

-- ── 6. 시스템 상태 (시스템 관리자) ─────────────────────────────────────────
create or replace function public.bo_system()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'usage_today', coalesce((
      select jsonb_object_agg(kind, total)
      from (
        select kind, sum(count)::bigint as total
        from usage_counters
        where day = (now() at time zone 'Asia/Seoul')::date
        group by kind
      ) u
    ), '{}'::jsonb),
    'open_reports', (select count(*) from content_reports where status = 'open'),
    'device_tokens', (select count(*) from device_tokens),
    'location_pings_old', (select count(*) from location_pings where created_at < now() - interval '90 days'),
    'points_expiring_7d', (select coalesce(sum(remaining), 0)::bigint from points_ledger
                           where remaining > 0 and expires_at between now() and now() + interval '7 days')
  )
$$;

revoke all on function public.bo_overview(integer) from public, anon, authenticated;
revoke all on function public.bo_product(integer) from public, anon, authenticated;
revoke all on function public.bo_merchandising(integer) from public, anon, authenticated;
revoke all on function public.bo_growth(integer) from public, anon, authenticated;
revoke all on function public.bo_timeseries(integer) from public, anon, authenticated;
revoke all on function public.bo_system() from public, anon, authenticated;

-- 2026-07-28 보완: 앱 노출 조건(status active + 유효기간 내)을 백오피스가 그대로 판정한다.
-- "파트너에겐 살아 있어 보이는데 앱엔 없는 쿠폰"을 운영자가 먼저 발견해야 한다 — 최신 정의는
-- 마이그레이션 20260728020_bo_md_expiry.sql 참조.
