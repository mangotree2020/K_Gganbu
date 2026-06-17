-- =============================================================================
-- 쿠폰/파트너 시드 데이터 (BACKLOG #23) — 부산 외국인 전용 쿠폰 데모
-- =============================================================================
-- 화면 필터(food/cafe/beauty/activity)를 위해 coupons.category 컬럼 추가.
alter table public.coupons add column if not exists category text;

-- 파트너 (정산정보 없음 — 데모)
insert into public.partners (name, status)
select v.name, 'active'::partner_status
from (values
  ('Halmae Gukbap'), ('Bada View Cafe'), ('Glow K-Beauty'),
  ('Songdo Cable Car'), ('Jagalchi Street Food'), ('Haeundae Spa Land')
) as v(name)
where not exists (select 1 from public.partners p where p.name = v.name);

-- 쿠폰 (다국어 title/조건, 카테고리, 90일 유효)
insert into public.coupons
  (title_i18n, partner_id, discount_type, discount_value, usage_condition_i18n, category, valid_until, status)
select c.title::jsonb, p.id, c.dtype::coupon_discount_type, c.dval,
       c.cond::jsonb, c.category, now() + interval '90 days', 'active'::coupon_status
from (values
  ('{"en":"Halmae Gukbap","ko":"할매국밥","ja":"ハルメクッパ","zh-CN":"奶奶汤饭","zh-TW":"奶奶湯飯"}',
   'Halmae Gukbap', 'percentage', 10,
   '{"en":"Dine-in only · today","ko":"매장 한정 · 오늘","ja":"店内のみ・本日"}', 'food'),
  ('{"en":"Bada View Cafe","ko":"바다뷰 카페","ja":"海ビューカフェ","zh-CN":"海景咖啡","zh-TW":"海景咖啡"}',
   'Bada View Cafe', 'freebie', null,
   '{"en":"Free drink with 2+ orders","ko":"2잔 이상 주문 시 음료 1잔 무료","ja":"2杯以上で1杯無料"}', 'cafe'),
  ('{"en":"Glow K-Beauty","ko":"글로우 K뷰티","ja":"グロウKビューティー","zh-CN":"Glow韩妆","zh-TW":"Glow韓妝"}',
   'Glow K-Beauty', 'fixed', 5000,
   '{"en":"₩5,000 off facial","ko":"페이셜 5,000원 할인","ja":"フェイシャル5,000ウォン引き"}', 'beauty'),
  ('{"en":"Songdo Cable Car","ko":"송도 케이블카","ja":"松島ケーブルカー","zh-CN":"松岛缆车","zh-TW":"松島纜車"}',
   'Songdo Cable Car', 'percentage', 15,
   '{"en":"Foreigner pass · show passport","ko":"외국인 · 여권 제시","ja":"外国人・パスポート提示"}', 'activity'),
  ('{"en":"Jagalchi Street Food","ko":"자갈치 길거리음식","ja":"チャガルチ屋台","zh-CN":"札嘎其街边小吃","zh-TW":"札嘎其街邊小吃"}',
   'Jagalchi Street Food', 'freebie', null,
   '{"en":"Free side with any order","ko":"주문 시 사이드 무료","ja":"注文でサイド無料"}', 'food'),
  ('{"en":"Haeundae Spa Land","ko":"해운대 스파랜드","ja":"海雲台スパランド","zh-CN":"海云台水疗乐园","zh-TW":"海雲台水療樂園"}',
   'Haeundae Spa Land', 'percentage', 30,
   '{"en":"Weekday entry","ko":"평일 입장","ja":"平日入場"}', 'beauty')
) as c(title, partner_name, dtype, dval, cond, category)
join public.partners p on p.name = c.partner_name
where not exists (
  select 1 from public.coupons x where x.title_i18n->>'en' = (c.title::jsonb)->>'en'
);
