-- 내 리뷰 저장소 (UX_REVIEW §4-4 "QR 사용 완료 → 1탭 리뷰 요청", REQ-UGC-2 선행)
-- 지금까지 내 리뷰는 mock 이었다. 실후기가 쌓이는 경로가 없으면 후기 피드(UGC)도,
-- 리뷰 기반 추천도 전부 가짜로 남는다. 가장 자연스러운 수집 시점은 "쿠폰을 실제로 쓴 직후"다.
--
-- 중복 방지: 쿠폰 사용 1건당 리뷰 1개(ref_id 부분 unique) — 같은 QR로 별점을 여러 번 남길 수 없다.
-- 공개 범위: 본인만 읽고 쓴다. 타인 노출(피드)은 REQ-UGC-2 에서 별도 정책·신고 기능과 함께 연다.

create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  place_name text not null,
  place_key  text,                                   -- google place_id 등 외부 키(있으면)
  cat        text,                                   -- PlaceThumb 카테고리
  rating     smallint not null check (rating between 1 and 5),
  body       text,                                   -- 본문(선택 — 별점만 남겨도 된다)
  source     text not null default 'manual' check (source in ('manual', 'coupon_redeem')),
  ref_id     uuid,                                   -- coupon_issues.id (사용 1건당 1리뷰)
  created_at timestamptz not null default now()
);

create index idx_reviews_user on public.reviews (user_id, created_at desc);
create unique index uq_reviews_ref on public.reviews (user_id, ref_id) where ref_id is not null;

alter table public.reviews enable row level security;

create policy "reviews_select_own" on public.reviews
  for select using (user_id = public.current_user_id());

create policy "reviews_insert_own" on public.reviews
  for insert with check (user_id = public.current_user_id());

create policy "reviews_update_own" on public.reviews
  for update using (user_id = public.current_user_id());

create policy "reviews_delete_own" on public.reviews
  for delete using (user_id = public.current_user_id());
