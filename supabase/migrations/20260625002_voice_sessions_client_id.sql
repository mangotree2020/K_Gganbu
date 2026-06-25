-- voice_sessions 멱등 업로드 키 — 오프라인 큐 재시도 시 중복 행 방지.
-- 클라이언트가 세션마다 생성한 client_id 로 upsert(onConflict do nothing).
alter table public.voice_sessions add column if not exists client_id text unique;
