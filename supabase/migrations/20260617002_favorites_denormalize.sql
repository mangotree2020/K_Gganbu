-- =============================================================================
-- favorites 비정규화 — 라이브 POI(TourAPI/Naver) 즐겨찾기 지원 (PLANNING §20, BACKLOG #20)
-- =============================================================================
-- 앱 POI는 외부 API(TourAPI/Naver)에서 실시간으로 오므로 places 테이블에 없을 수 있다.
-- place_id FK(큐레이션 POI용)는 유지하되, 외부 POI는 place_ext_id + 표시정보를 직접
-- 저장해 오프라인 보관·목록 표시가 가능하도록 한다.
alter table public.favorites add column if not exists place_ext_id text;
alter table public.favorites add column if not exists name text;
alter table public.favorites add column if not exists address text;
alter table public.favorites add column if not exists lat double precision;
alter table public.favorites add column if not exists lng double precision;
alter table public.favorites add column if not exists image_url text;
alter table public.favorites add column if not exists cat text;

-- 기존 unique(user_id, place_id, type) → 외부 id 기준으로 교체 (중복 즐겨찾기 방지)
alter table public.favorites drop constraint if exists favorites_user_id_place_id_type_key;
alter table public.favorites
  add constraint favorites_user_ext_unique unique (user_id, place_ext_id, type);

create index if not exists idx_favorites_ext on public.favorites(place_ext_id);
