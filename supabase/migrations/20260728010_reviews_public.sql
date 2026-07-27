-- 실 후기 피드 노출 (PRD REQ-UGC-2) — 지금까지 피드는 합성 데이터였다.
--
-- 공개는 명시 동의가 있을 때만: `is_public` 기본값 false.
--   쿠폰 사용 직후 별점은 "가게에 남기는 평가"에 가깝고, 사용자가 공개를 요청한 적이 없다.
--   기본 공개로 두면 본인도 모르게 여행 동선이 피드에 드러난다.
-- 작성자 표시는 스냅샷(author_name)으로 저장한다 — auth 메타데이터를 조인하면
--   공개 읽기 정책이 auth.users 를 필요로 하게 되고, 닉네임 변경 시 과거 글이 소급 변경된다.
-- 차단(REQ-UGC-3)은 조회하는 사람 기준으로 정책에서 함께 거른다.

alter table public.reviews add column if not exists is_public boolean not null default false;
alter table public.reviews add column if not exists author_name text;

create index if not exists idx_reviews_public on public.reviews (created_at desc)
  where is_public;

-- 공개 후기 읽기 — 내가 차단한 작성자의 글은 보이지 않는다
create policy "reviews_select_public" on public.reviews
  for select using (
    is_public
    and not exists (
      select 1 from public.blocked_authors b
      where b.user_id = public.current_user_id()
        and b.author_key = coalesce(reviews.author_name, '')
    )
  );
