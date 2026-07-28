-- MD 딜 성과에 '앱 노출 여부'를 반영 (REQ-BO-1 운영성 보완)
--
-- 문제: 앱은 status='active' **그리고 유효기간 내** 쿠폰만 노출한다(프론트 기준).
--   그런데 백오피스·파트너 화면은 status 만 봤다 → 파트너에겐 "운영 중"으로 보이는데
--   앱에는 없는 쿠폰이 생기고, 아무도 그 사실을 모른 채 "왜 손님이 안 오지"가 된다.
-- 해결: 앱과 같은 판정식을 백오피스가 그대로 쓴다(visible_in_app) + 만료/임박 카운트를 낸다.

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
      c.valid_until,
      -- 앱은 status='active' + 유효기간 내 쿠폰만 노출한다(프론트 기준).
      -- 그래서 "active 인데 기간이 지난" 쿠폰은 파트너에겐 살아 있어 보이고 앱엔 없는 상태다 → 표시해준다
      case
        when c.valid_until is null then 'ok'
        when c.valid_until < now() then 'expired'
        when c.valid_until < now() + interval '7 days' then 'soon'
        else 'ok'
      end as expiry,
      -- 앱 노출 조건과 동일한 판정
      (c.status = 'active' and (c.valid_until is null or c.valid_until >= now())) as visible_in_app,
      (select count(*) from coupon_issues i, win where i.coupon_id = c.id and i.issued_at >= win.since) as issued,
      (select count(*) from coupon_issues i, win where i.coupon_id = c.id and i.used_at >= win.since) as used
    from coupons c left join partners p on p.id = c.partner_id
    where c.status = 'active'
  )
  select jsonb_build_object(
    'partners_total', (select count(*) from partners where status = 'active'),
    'partners_without_coords', (select count(*) from partners where status = 'active' and (lat is null or lng is null)),
    'coupons_active', (select count(*) from coupons where status = 'active'),
    'coupons_visible', (select count(*) from deals where visible_in_app),
    'coupons_expired', (select count(*) from deals where expiry = 'expired'),
    'coupons_expiring_soon', (select count(*) from deals where expiry = 'soon'),
    'by_category', coalesce((
      select jsonb_object_agg(coalesce(category, 'etc'), n)
      from (select category, count(*)::bigint as n from coupons where status='active' group by category) t
    ), '{}'::jsonb),
    'deals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', title, 'partner', partner, 'category', category,
        'issued', issued, 'used', used,
        'use_rate', case when issued > 0 then round(used::numeric * 100 / issued, 1) else 0 end,
        'expiry', expiry, 'visible', visible_in_app
      ) order by used desc, issued desc)
      from deals
    ), '[]'::jsonb)
  )
$$;
