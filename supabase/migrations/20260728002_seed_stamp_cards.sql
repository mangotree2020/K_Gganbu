-- 테마 스탬프 카드 시드 (REQ-ST-2) — 20260617003 의 데모 파트너를 묶은 예시 카드 2종.
-- 데모 파트너가 없는 DB(실 운영)에서는 아무것도 생성되지 않는다(where exists 가드).
-- 실 파트너 카드는 Admin(파트너 등록) 이후 운영이 등록한다.

insert into public.stamp_cards (code, title_i18n, desc_i18n, region, theme, bonus_points, reward_coupon_id)
select
  'busan-food-tour',
  '{"en":"Busan Food Tour","ko":"부산 먹킷리스트","ja":"釜山グルメツアー","zh-CN":"釜山美食巡礼","zh-TW":"釜山美食巡禮"}'::jsonb,
  '{"en":"Visit 3 local favorites and collect all stamps","ko":"현지 맛집 3곳을 모두 방문하세요","ja":"地元の名店3軒を制覇しよう","zh-CN":"打卡3家当地人气店","zh-TW":"打卡3家當地人氣店"}'::jsonb,
  'busan', 'food', 200,
  (select id from public.coupons where title_i18n->>'en' = 'Songdo Cable Car' limit 1)
where exists (select 1 from public.partners where name = 'Halmae Gukbap')
  and not exists (select 1 from public.stamp_cards where code = 'busan-food-tour');

insert into public.stamp_card_items (card_id, partner_id, sort_order)
select c.id, p.id, v.ord
from public.stamp_cards c
join (values ('Halmae Gukbap', 0), ('Jagalchi Street Food', 1), ('Bada View Cafe', 2)) as v(name, ord)
  on true
join public.partners p on p.name = v.name
where c.code = 'busan-food-tour'
  and not exists (
    select 1 from public.stamp_card_items i where i.card_id = c.id and i.partner_id = p.id
  );

insert into public.stamp_cards (code, title_i18n, desc_i18n, region, theme, bonus_points)
select
  'busan-relax',
  '{"en":"Busan Relax Day","ko":"부산 힐링 데이","ja":"釜山リラックスデー","zh-CN":"釜山放松一日","zh-TW":"釜山放鬆一日"}'::jsonb,
  '{"en":"Spa and beauty stops for a slow day","ko":"스파·뷰티로 채우는 하루","ja":"スパと美容でのんびり一日","zh-CN":"水疗与美妆的悠闲一天","zh-TW":"水療與美妝的悠閒一天"}'::jsonb,
  'busan', 'beauty', 150
where exists (select 1 from public.partners where name = 'Haeundae Spa Land')
  and not exists (select 1 from public.stamp_cards where code = 'busan-relax');

insert into public.stamp_card_items (card_id, partner_id, sort_order)
select c.id, p.id, v.ord
from public.stamp_cards c
join (values ('Haeundae Spa Land', 0), ('Glow K-Beauty', 1)) as v(name, ord)
  on true
join public.partners p on p.name = v.name
where c.code = 'busan-relax'
  and not exists (
    select 1 from public.stamp_card_items i where i.card_id = c.id and i.partner_id = p.id
  );
