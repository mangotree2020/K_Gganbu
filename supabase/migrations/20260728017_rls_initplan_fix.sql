-- RLS 평가 최적화 + 잔여 FK 인덱스 (어드바이저 점검 마무리)
--
-- ① users 정책이 `auth.uid()` 를 **행마다** 재평가한다. `(select auth.uid())` 로 감싸면
--    쿼리당 1회로 접히며(InitPlan) 결과는 동일하다. 사용자 목록을 스캔하는 조인에서 차이가 난다.
-- ② favorites.place_id FK 커버링 인덱스 — places 삭제·조인 시 전체 스캔 방지.
--    (이번 신규 테이블 정리와 같은 계열이라 함께 처리)

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select using (auth_id = (select auth.uid()));

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (auth_id = (select auth.uid()))
  with check (auth_id = (select auth.uid()));

create index if not exists idx_favorites_place_id on public.favorites (place_id)
  where place_id is not null;
