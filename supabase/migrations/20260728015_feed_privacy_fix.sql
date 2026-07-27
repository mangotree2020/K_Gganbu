-- 피드 좋아요 프라이버시·집계 일관성 수정 (REQ-UGC-2 후속, 어드바이저 점검 반영)
--
-- ① `feed_likes_select_all` 은 좋아요 **행 전체**를 공개했다 → 누구든 "어떤 사용자가 어떤 글에
--    좋아요를 눌렀는지" 열거할 수 있었다. 화면에 필요한 건 개수뿐이므로 행은 본인 것만 열고,
--    개수는 집계 함수(feed_counts, security definer)로만 노출한다.
--    (partners.stamp_secret 과 같은 계열의 실수 — "정책이 행 단위라 컬럼/행 노출 범위를 놓친 경우")
-- ② feed_counts 는 security definer 라 RLS 를 우회해 **차단한 작성자의 댓글까지** 세고 있었다.
--    목록에는 3개인데 카운트가 5로 보이는 불일치 → 집계에서도 차단을 동일하게 적용한다.

drop policy if exists "feed_likes_select_all" on public.feed_likes;

create policy "feed_likes_select_own" on public.feed_likes
  for select using (user_id = public.current_user_id());

create or replace function public.feed_counts(p_post_ids text[])
returns table (post_id text, likes bigint, comments bigint, liked_by_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.post_id,
    (select count(*) from feed_likes l where l.post_id = p.post_id)::bigint,
    -- 내가 차단한 작성자의 댓글은 목록에서 안 보이므로 개수에서도 뺀다(표시 일관성)
    (
      select count(*) from feed_comments c
      where c.post_id = p.post_id
        and not exists (
          select 1 from blocked_authors b
          where b.user_id = current_user_id() and b.author_key = c.author_name
        )
    )::bigint,
    exists (
      select 1 from feed_likes l2
      where l2.post_id = p.post_id and l2.user_id = current_user_id()
    )
  from unnest(p_post_ids) as p(post_id)
$$;
