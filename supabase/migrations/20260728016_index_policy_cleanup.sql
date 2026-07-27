-- 인덱스·정책 정리 (어드바이저 점검 반영 — 이번 R3/R4 신규 테이블 대상)
--
-- ① FK 커버링 인덱스 누락: 부모 행 삭제·조인 시 전체 스캔이 된다.
--    특히 users/stamp_cards 삭제는 cascade 대상이라 방치하면 삭제가 급격히 느려진다.
-- ② SELECT 정책 중복: `for all` 로 만든 쓰기 정책이 SELECT 에도 걸려 조회마다 정책이 2번 평가된다.
--    쓰기를 INSERT/UPDATE/DELETE 로 분리해 SELECT 경로에는 정책이 하나만 남게 한다.
--    (동작은 동일 — 쓰기 조건은 그대로 본인 행)
-- ③ reviews 는 "본인 것" + "공개 것" 두 SELECT 정책을 하나로 합친다.

-- ── ① FK 인덱스 ──────────────────────────────────────────────────────────────
create index if not exists idx_content_reports_reporter on public.content_reports (reporter_id, created_at desc);
create index if not exists idx_feed_comments_user on public.feed_comments (user_id);
create index if not exists idx_feed_comments_parent on public.feed_comments (parent_id) where parent_id is not null;
create index if not exists idx_stamp_card_completions_card on public.stamp_card_completions (card_id);
create index if not exists idx_stamp_card_completions_coupon on public.stamp_card_completions (coupon_id) where coupon_id is not null;
create index if not exists idx_stamp_card_items_partner on public.stamp_card_items (partner_id);
create index if not exists idx_stamp_cards_reward_coupon on public.stamp_cards (reward_coupon_id) where reward_coupon_id is not null;

-- ── ② 쓰기 정책을 명령별로 분리 (SELECT 중복 제거) ───────────────────────────
drop policy if exists "feed_likes_write_own" on public.feed_likes;
create policy "feed_likes_insert_own" on public.feed_likes
  for insert with check (user_id = public.current_user_id());
create policy "feed_likes_delete_own" on public.feed_likes
  for delete using (user_id = public.current_user_id());

drop policy if exists "feed_comments_write_own" on public.feed_comments;
create policy "feed_comments_insert_own" on public.feed_comments
  for insert with check (user_id = public.current_user_id());
create policy "feed_comments_update_own" on public.feed_comments
  for update using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());
create policy "feed_comments_delete_own" on public.feed_comments
  for delete using (user_id = public.current_user_id());

drop policy if exists "blocked_authors_all_own" on public.blocked_authors;
create policy "blocked_authors_select_own" on public.blocked_authors
  for select using (user_id = public.current_user_id());
create policy "blocked_authors_insert_own" on public.blocked_authors
  for insert with check (user_id = public.current_user_id());
create policy "blocked_authors_delete_own" on public.blocked_authors
  for delete using (user_id = public.current_user_id());

-- ── ③ reviews SELECT 정책 단일화 ────────────────────────────────────────────
drop policy if exists "reviews_select_own" on public.reviews;
drop policy if exists "reviews_select_public" on public.reviews;
create policy "reviews_select_visible" on public.reviews
  for select using (
    user_id = public.current_user_id()
    or (
      is_public
      and not exists (
        select 1 from public.blocked_authors b
        where b.user_id = public.current_user_id()
          and b.author_key = coalesce(reviews.author_name, '')
      )
    )
  );
