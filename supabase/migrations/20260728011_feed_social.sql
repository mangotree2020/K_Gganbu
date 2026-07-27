-- 피드 좋아요·댓글 서버 저장 (PRD REQ-UGC-2 잔여)
-- 지금까지 좋아요·댓글은 MMKV 로컬이라 기기를 바꾸면 사라지고 다른 사람에게 보이지도 않았다.
--
-- post_id 를 text 로 두는 이유: 피드에는 실 후기(`rv:<uuid>`)와 합성 포스트(POI 기반 id)가
--   섞여 있고, 실 UGC 전환은 점진적이다. 외래키 대신 문자열 키로 두어 두 종류를 함께 담는다.
-- 로컬(MMKV)은 계속 유지한다 — 게스트·오프라인에서도 즉시 반응해야 하고,
--   서버 저장은 로그인 사용자의 동기화·타인 노출을 담당한다.
-- 차단(REQ-UGC-3)은 댓글 조회 정책에서 함께 적용한다.

create table public.feed_likes (
  user_id    uuid not null references public.users(id) on delete cascade,
  post_id    text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index idx_feed_likes_post on public.feed_likes (post_id);

alter table public.feed_likes enable row level security;

-- 좋아요 수는 공개(집계), 개별 행은 본인 것만 쓰고 지운다
create policy "feed_likes_select_all" on public.feed_likes for select using (true);
create policy "feed_likes_write_own" on public.feed_likes
  for all using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create table public.feed_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     text not null,
  user_id     uuid not null references public.users(id) on delete cascade,
  author_name text not null default 'Traveler',   -- 표시 이름 스냅샷(reviews 와 동일 원칙)
  parent_id   uuid references public.feed_comments(id) on delete cascade,  -- 1단계 대댓글
  body        text not null check (length(btrim(body)) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index idx_feed_comments_post on public.feed_comments (post_id, created_at);

alter table public.feed_comments enable row level security;

-- 읽기: 내가 차단한 작성자의 댓글은 제외
create policy "feed_comments_select_visible" on public.feed_comments
  for select using (
    not exists (
      select 1 from public.blocked_authors b
      where b.user_id = public.current_user_id()
        and b.author_key = feed_comments.author_name
    )
  );

create policy "feed_comments_write_own" on public.feed_comments
  for all using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

-- =============================================================================
-- feed_counts — 여러 포스트의 좋아요·댓글 수 + 내 좋아요 여부를 한 번에
--   (카드마다 개별 쿼리를 날리면 스크롤 중 요청이 폭증한다)
-- =============================================================================
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
    (select count(*) from feed_comments c where c.post_id = p.post_id)::bigint,
    exists (
      select 1 from feed_likes l2
      where l2.post_id = p.post_id and l2.user_id = current_user_id()
    )
  from unnest(p_post_ids) as p(post_id)
$$;
