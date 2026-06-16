-- =============================================================================
-- 함수 보안 강화 (Supabase security advisor 대응)
-- =============================================================================

-- set_updated_at: search_path 고정 (function_search_path_mutable)
alter function public.set_updated_at() set search_path = '';

-- current_user_id: SECURITY INVOKER 로 전환
-- users RLS 정책이 auth.uid() 를 직접 사용하므로 재귀가 없어 DEFINER 불필요
-- (INVOKER 로 호출 시 users_select_own 정책이 본인 행을 허용 → 동작 동일)
alter function public.current_user_id() security invoker;

-- handle_new_user: auth.users INSERT 트리거 전용 → 직접 RPC 호출 권한 회수
-- 트리거는 권한과 무관하게 실행되므로 안전
revoke execute on function public.handle_new_user() from anon, authenticated, public;
