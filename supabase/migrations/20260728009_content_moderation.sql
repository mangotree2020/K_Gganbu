-- UGC 안전장치 (PRD REQ-UGC-3) — 신고·차단
-- 앱은 이미 후기 피드(작성자·본문·댓글)를 사용자에게 보여준다. 데이터가 아직 합성이더라도
-- 화면상으로는 UGC 이므로, 신고·차단 수단이 없으면 스토어 심사에서 문제가 되고
-- 실 UGC(REQ-UGC-2) 전환 시점에 급하게 만들게 된다. 먼저 배관을 깔아둔다.
--
-- 차단은 "내가 안 보는 것"이라 클라이언트가 즉시 반영하고(로컬), 서버에도 남겨 기기 간 동기화한다.
-- 신고는 운영 대응 큐 — 본인이 넣은 신고만 조회 가능(다른 사람의 신고 내용은 보이지 않는다).

create table public.content_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'user')),
  target_id   text not null,                    -- 합성 피드는 문자열 id, 실 UGC 는 uuid 문자열
  reason      text not null check (reason in ('spam', 'offensive', 'sexual', 'violence', 'other')),
  note        text,
  status      text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at  timestamptz not null default now()
);

create index idx_content_reports_target on public.content_reports (target_type, target_id, created_at desc);
create index idx_content_reports_open on public.content_reports (status, created_at desc);

alter table public.content_reports enable row level security;

create policy "content_reports_insert_own" on public.content_reports
  for insert with check (reporter_id = public.current_user_id());

create policy "content_reports_select_own" on public.content_reports
  for select using (reporter_id = public.current_user_id());

-- 차단 목록 — 내가 가린 작성자
create table public.blocked_authors (
  user_id    uuid not null references public.users(id) on delete cascade,
  author_key text not null,                     -- 합성 피드는 작성자명, 실 UGC 는 작성자 uuid
  created_at timestamptz not null default now(),
  primary key (user_id, author_key)
);

alter table public.blocked_authors enable row level security;

create policy "blocked_authors_all_own" on public.blocked_authors
  for all using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());
