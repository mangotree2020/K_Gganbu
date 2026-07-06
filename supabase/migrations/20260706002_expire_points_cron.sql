-- 포인트 소멸 배치 스케줄 (REQ-PT-2 — 유효기간 180일 자동 소멸)
-- pg_cron 으로 매일 KST 00:10 (UTC 15:10) 에 만료 로트를 소멸 처리.
-- 잔액 계산은 expires_at 을 직접 보므로 배치가 지연·중복 실행돼도 잔액은 항상 정확(멱등).
create extension if not exists pg_cron;

select cron.schedule(
  'expire-points-daily',
  '10 15 * * *', -- UTC 15:10 = KST 00:10
  $$select public.expire_points()$$
);
