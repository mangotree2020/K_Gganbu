-- 포인트 원장 (PRD REQ-PT-1·2, BM§3.5 포인트 경제 유닛 이코노믹스)
-- 설계 원칙 (하드 가드레일 — BM§3.5 "세 가지가 깨지면 실패"):
--   ① 무상 발행 전용 — source 에 유상 충전·구매 계열이 존재하지 않음 (전금법 비해당 설계, O-7)
--   ② 적립원별 일 상한 서버 강제 — steps 100P / stamp 150P / challenge·game 공유 30P (KST 일 단위)
--   ③ 유효기간 180일 — earn 로트별 expires_at, expire_points() 배치로 자동 소멸
-- 회계 방식: 로트(FIFO) — earn 행이 remaining(미소진 잔량)을 보유, spend 는 오래된 로트부터 소진.
--   잔액 = 유효 로트(expires_at > now) remaining 합 → 소멸 배치가 지연돼도 잔액은 항상 정확.
-- 쓰기(적립·차감·소멸)는 Edge Function(service role) 전용, 클라이언트는 본인 내역 읽기만.

-- =============================================================================
-- 1. points_ledger — append-only 원장 (감사 로그 겸)
-- =============================================================================
create table public.points_ledger (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  kind             text not null check (kind in ('earn', 'spend', 'expire', 'revert')),
  source           text not null check (source in ('steps', 'stamp', 'challenge', 'game', 'gifticon', 'admin')),
  amount           integer not null,              -- earn/revert 양수, spend/expire 음수
  remaining        integer,                       -- earn/revert 로트의 미소진 잔량 (spend/expire 는 null)
  expires_at       timestamptz,                   -- 로트 소멸 시각 = 적립 + 180일
  idempotency_key  text not null unique,          -- 중복 적립·차감 원천 차단
  ref_id           uuid,                          -- 연관 엔티티 (기프티콘 주문, 스탬프, 원복 대상 spend 등)
  meta             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  -- 로트(earn/revert)는 remaining·expires_at 필수, 차감(spend/expire)은 금액만 음수로 기록
  check (
    (kind in ('earn', 'revert') and amount > 0 and remaining between 0 and amount and expires_at is not null)
    or (kind in ('spend', 'expire') and amount < 0 and remaining is null)
  )
);

create index idx_points_ledger_lots on public.points_ledger (user_id, expires_at, created_at)
  where remaining > 0;                                          -- FIFO 소진·잔액 스캔
create index idx_points_ledger_history on public.points_ledger (user_id, created_at desc);
create index idx_points_ledger_daily_cap on public.points_ledger (user_id, kind, source, created_at);
create index idx_points_ledger_expiry on public.points_ledger (expires_at) where remaining > 0;  -- 소멸 배치

alter table public.points_ledger enable row level security;

-- 본인 내역 읽기만 (포인트 홈 REQ-PT-4) — 쓰기 정책 없음 = Edge Function(service role) 전용
create policy "points_ledger_select_own" on public.points_ledger
  for select using (user_id = public.current_user_id());

-- =============================================================================
-- 2. 잔액 뷰 — 유효 로트 합산 (security_invoker 로 기저 RLS 적용)
-- =============================================================================
create view public.points_balance
with (security_invoker = true) as
select
  user_id,
  coalesce(sum(remaining) filter (where expires_at > now()), 0)::integer as balance,
  min(expires_at) filter (where remaining > 0 and expires_at > now()) as next_expires_at,
  coalesce(sum(remaining) filter (
    where expires_at > now() and expires_at <= now() + interval '30 days'
  ), 0)::integer as expiring_30d
from public.points_ledger
where remaining > 0
group by user_id;

-- =============================================================================
-- 3. 잔액 헬퍼 (RPC 내부용 — service role 전용)
-- =============================================================================
create or replace function public.points_balance_of(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(remaining), 0)::integer
  from points_ledger
  where user_id = p_user and remaining > 0 and expires_at > now()
$$;

-- =============================================================================
-- 4. earn_points — 적립 (일 상한 서버 강제 + 멱등)
--    상한 초과분은 잘라서 적립(clamp), 상한 도달 시 granted 0. admin 은 운영 수동 지급으로 상한 없음.
-- =============================================================================
create or replace function public.earn_points(
  p_user uuid,
  p_source text,
  p_amount integer,
  p_idem text,
  p_ref uuid default null,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap integer;
  v_group text[];                -- 상한을 공유하는 적립원 묶음 (challenge·game — REQ-GM-2)
  v_today integer;
  v_grant integer;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  -- 적립원별 일 상한 (BM§3.5 발행 캡)
  case p_source
    when 'steps' then v_cap := 100; v_group := array['steps'];
    when 'stamp' then v_cap := 150; v_group := array['stamp'];
    when 'challenge' then v_cap := 30; v_group := array['challenge', 'game'];
    when 'game' then v_cap := 30; v_group := array['challenge', 'game'];
    when 'admin' then v_cap := null; v_group := null;
    else return jsonb_build_object('ok', false, 'error', 'invalid_source');
  end case;

  -- 멱등: 동일 키 재호출은 무적립으로 종료 (중복 적립 차단)
  if exists (select 1 from points_ledger where idempotency_key = p_idem) then
    return jsonb_build_object('ok', true, 'granted', 0, 'duplicate', true,
      'balance', points_balance_of(p_user));
  end if;

  -- 사용자 단위 직렬화 — 경쟁 요청에서도 상한 우회 불가 (bump_usage 와 동일 취지)
  perform pg_advisory_xact_lock(hashtext('points:' || p_user::text));

  if v_cap is not null then
    select coalesce(sum(amount), 0) into v_today
    from points_ledger
    where user_id = p_user and kind = 'earn' and source = any(v_group)
      and (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date;
    v_grant := least(p_amount, greatest(v_cap - v_today, 0));
  else
    v_grant := p_amount;
  end if;

  if v_grant <= 0 then
    return jsonb_build_object('ok', true, 'granted', 0, 'capped', true,
      'balance', points_balance_of(p_user));
  end if;

  insert into points_ledger (user_id, kind, source, amount, remaining, expires_at, idempotency_key, ref_id, meta)
  values (p_user, 'earn', p_source, v_grant, v_grant, now() + interval '180 days', p_idem, p_ref, p_meta);

  return jsonb_build_object('ok', true, 'granted', v_grant, 'capped', v_grant < p_amount,
    'balance', points_balance_of(p_user));
end;
$$;

-- =============================================================================
-- 5. spend_points — 차감 (FIFO 소진, 잔액 부족 거부, 멱등)
--    기프티콘 혼합 결제(REQ-GS-2)에서 사용. 사용 상한 30% 등 상품별 정책은 호출부(Edge Function) 책임.
-- =============================================================================
create or replace function public.spend_points(
  p_user uuid,
  p_amount integer,
  p_idem text,
  p_source text default 'gifticon',
  p_ref uuid default null,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_left integer;
  lot record;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;
  if p_source not in ('gifticon', 'admin') then
    return jsonb_build_object('ok', false, 'error', 'invalid_source');
  end if;

  if exists (select 1 from points_ledger where idempotency_key = p_idem) then
    return jsonb_build_object('ok', true, 'spent', 0, 'duplicate', true,
      'balance', points_balance_of(p_user));
  end if;

  perform pg_advisory_xact_lock(hashtext('points:' || p_user::text));

  v_balance := points_balance_of(p_user);
  if v_balance < p_amount then
    return jsonb_build_object('ok', false, 'error', 'insufficient', 'balance', v_balance);
  end if;

  -- FIFO: 소멸 임박 로트부터 소진
  v_left := p_amount;
  for lot in
    select id, remaining from points_ledger
    where user_id = p_user and remaining > 0 and expires_at > now()
    order by expires_at asc, created_at asc
  loop
    exit when v_left = 0;
    if lot.remaining >= v_left then
      update points_ledger set remaining = remaining - v_left where id = lot.id;
      v_left := 0;
    else
      update points_ledger set remaining = 0 where id = lot.id;
      v_left := v_left - lot.remaining;
    end if;
  end loop;

  insert into points_ledger (user_id, kind, source, amount, idempotency_key, ref_id, meta)
  values (p_user, 'spend', p_source, -p_amount, p_idem, p_ref, p_meta);

  return jsonb_build_object('ok', true, 'spent', p_amount,
    'balance', points_balance_of(p_user));
end;
$$;

-- =============================================================================
-- 6. revert_spend — 차감 원복 (결제 실패 시 포인트 원복, REQ-GS-2)
--    원본 로트 복원 대신 신규 로트(kind=revert, 180일)로 지급 — 회계 단순·감사 추적 명확.
-- =============================================================================
create or replace function public.revert_spend(
  p_spend_idem text,
  p_idem text,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spend points_ledger;
begin
  select * into v_spend from points_ledger
  where idempotency_key = p_spend_idem and kind = 'spend';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'spend_not_found');
  end if;

  if exists (select 1 from points_ledger where idempotency_key = p_idem) then
    return jsonb_build_object('ok', true, 'reverted', 0, 'duplicate', true,
      'balance', points_balance_of(v_spend.user_id));
  end if;

  perform pg_advisory_xact_lock(hashtext('points:' || v_spend.user_id::text));

  insert into points_ledger (user_id, kind, source, amount, remaining, expires_at, idempotency_key, ref_id, meta)
  values (v_spend.user_id, 'revert', v_spend.source, -v_spend.amount, -v_spend.amount,
    now() + interval '180 days', p_idem, v_spend.id, p_meta);

  return jsonb_build_object('ok', true, 'reverted', -v_spend.amount,
    'balance', points_balance_of(v_spend.user_id));
end;
$$;

-- =============================================================================
-- 7. expire_points — 180일 경과 로트 일괄 소멸 배치
--    스케줄: Supabase cron(pg_cron)으로 일 1회 `select public.expire_points()` 등록 (SETUP_EXTERNAL).
--    잔액 뷰·points_balance_of 는 expires_at 을 직접 보므로 배치 지연에도 잔액은 정확.
-- =============================================================================
create or replace function public.expire_points()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with target as (
    select id, user_id, source, remaining
    from points_ledger
    where remaining > 0 and expires_at <= now()
    for update skip locked
  ),
  zeroed as (
    update points_ledger l set remaining = 0
    from target t where l.id = t.id
  )
  insert into points_ledger (user_id, kind, source, amount, idempotency_key, ref_id)
  select t.user_id, 'expire', t.source, -t.remaining, 'expire:' || t.id::text, t.id
  from target t
  on conflict (idempotency_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =============================================================================
-- 8. 권한 — RPC 전부 Edge Function(service role) 전용 (bump_usage 패턴)
-- =============================================================================
revoke all on function public.points_balance_of(uuid) from public, anon, authenticated;
revoke all on function public.earn_points(uuid, text, integer, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.spend_points(uuid, integer, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.revert_spend(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.expire_points() from public, anon, authenticated;
