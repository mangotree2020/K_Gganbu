-- 파트너 매장 위치 (LBS 딜 매칭) — 상점 주소 기반 지오코딩 좌표.
-- 홈 Today's Pick ↔ 딜 매칭을 이름이 아닌 좌표 근접성으로 판정하기 위한 기반.
alter table public.partners add column if not exists address text;
alter table public.partners add column if not exists lat double precision;
alter table public.partners add column if not exists lng double precision;
