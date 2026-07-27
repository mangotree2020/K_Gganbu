-- 테마 스탬프 카드 (PRD REQ-ST-2, BM§5 S-6 + S-1)
-- "서면 카페 5곳" 같은 테마 묶음을 정의하고, 카드에 속한 제휴 매장을 모두 방문하면
-- 완성 보너스(포인트) + 보상 쿠폰을 준다. 스탬프 자체의 적립은 REQ-ST-1(stamp EF)이 담당하고,
-- 여기서는 "이미 적립된 방문(stamp_visits)"을 근거로 완성 여부만 판정한다.
--
-- 설계 원칙
--   ① 완성 판정 근거는 서버의 stamp_visits — 클라이언트 신고 값 신뢰 없음(GPS 단독 인증 금지 원칙 유지)
--   ② 보너스는 카드당 1회 (stamp_card_completions unique + 원장 멱등키 이중 차단)
--   ③ 보너스 적립원은 신규 source 'stamp_card' — 일 상한 200P (방문 적립 stamp 150P와 별도 캡).
--      카드 완성은 카드당 1회뿐인 희소 이벤트라 방문 캡에 합산하면 보너스가 상시 잘려 무의미해진다.
--   ④ 보상 쿠폰은 미리 발급하지 않는다(coupon_issues 는 TTL 5분 QR 단위) —
--      완성 기록에 coupon_id 만 남기고, 실제 QR 은 기존 쿠폰 발급 경로를 그대로 탄다.

-- =============================================================================
-- 0. 보안 수정 — partners.stamp_secret 공개 노출 차단 (REQ-ST-1 위조 방지의 전제)
--    partners 는 "활성 파트너 공개 읽기" 정책이라 RLS(행 단위)만으로는 컬럼을 못 가린다.
--    20260708002 에서 추가한 stamp_secret 이 anon 에게 그대로 읽혀 QR 위조가 가능했다.
--    → 테이블 단위 select 를 회수하고 안전 컬럼만 컬럼 단위로 재부여(정산정보도 함께 차단).
--    ⚠️ 이후 partners 에 컬럼을 추가하면 여기에도 grant 를 추가해야 클라이언트에서 읽힌다.
-- =============================================================================
revoke select on public.partners from anon, authenticated;
grant select (id, name, contact, place_id, status, address, lat, lng, created_at, updated_at)
  on public.partners to anon, authenticated;

-- =============================================================================
-- 1. 원장 source 확장 — 'stamp_card' (카드 완성 보너스)
-- =============================================================================
alter table public.points_ledger drop constraint if exists points_ledger_source_check;
alter table public.points_ledger add constraint points_ledger_source_check
  check (source in ('steps', 'stamp', 'stamp_card', 'challenge', 'game', 'gifticon', 'admin'));

-- earn_points: 'stamp_card' 일 상한 200P (단독 그룹 — 방문 적립 stamp 와 캡 분리)
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
  v_group text[];
  v_today integer;
  v_grant integer;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  case p_source
    when 'steps' then v_cap := 100; v_group := array['steps'];
    when 'stamp' then v_cap := 150; v_group := array['stamp'];
    when 'stamp_card' then v_cap := 200; v_group := array['stamp_card'];
    when 'challenge' then v_cap := 30; v_group := array['challenge', 'game'];
    when 'game' then v_cap := 30; v_group := array['challenge', 'game'];
    when 'admin' then v_cap := null; v_group := null;
    else return jsonb_build_object('ok', false, 'error', 'invalid_source');
  end case;

  if exists (select 1 from points_ledger where idempotency_key = p_idem) then
    return jsonb_build_object('ok', true, 'granted', 0, 'duplicate', true,
      'balance', points_balance_of(p_user));
  end if;

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

revoke all on function public.earn_points(uuid, text, integer, text, uuid, jsonb) from public, anon, authenticated;

-- =============================================================================
-- 2. stamp_cards — 테마 카드 정의 (공개 읽기)
-- =============================================================================
create table public.stamp_cards (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,                       -- 'busan-seomyeon-cafe'
  title_i18n       jsonb not null default '{}'::jsonb,         -- {en, ko, ja, zh-CN, zh-TW}
  desc_i18n        jsonb not null default '{}'::jsonb,
  region           text,                                       -- 'busan' 등 (지역 필터)
  theme            text not null default 'food',               -- 카드 아이콘·색 키 (cafe/food/culture/shopping)
  bonus_points     integer not null default 200 check (bonus_points between 0 and 200),
  reward_coupon_id uuid references public.coupons(id) on delete set null,
  required_count   integer,                                    -- null = 카드의 전체 매장 수
  valid_from       timestamptz,
  valid_until      timestamptz,
  status           text not null default 'active' check (status in ('active', 'inactive')),
  created_at       timestamptz not null default now()
);

create table public.stamp_card_items (
  card_id    uuid not null references public.stamp_cards(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (card_id, partner_id)
);

create index idx_stamp_card_items_card on public.stamp_card_items (card_id, sort_order);

-- 완성 기록 — 카드당 1회 (보너스 중복 지급 차단)
create table public.stamp_card_completions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  card_id       uuid not null references public.stamp_cards(id) on delete cascade,
  bonus_granted integer not null default 0,
  coupon_id     uuid references public.coupons(id) on delete set null,  -- 보상 쿠폰(있으면)
  completed_at  timestamptz not null default now(),
  unique (user_id, card_id)
);

create index idx_stamp_card_completions_user on public.stamp_card_completions (user_id, completed_at desc);

-- =============================================================================
-- 3. RLS — 카드 정의는 공개 읽기, 완성 기록은 본인만. 쓰기는 Edge Function(service role) 전용
-- =============================================================================
alter table public.stamp_cards enable row level security;
alter table public.stamp_card_items enable row level security;
alter table public.stamp_card_completions enable row level security;

create policy "stamp_cards_public_read" on public.stamp_cards
  for select using (status = 'active');

create policy "stamp_card_items_public_read" on public.stamp_card_items
  for select using (
    exists (select 1 from public.stamp_cards c where c.id = card_id and c.status = 'active')
  );

create policy "stamp_card_completions_select_own" on public.stamp_card_completions
  for select using (user_id = public.current_user_id());

-- =============================================================================
-- 4. complete_stamp_card — 완성 판정 + 보너스 지급 (service role 전용)
--    판정 근거는 stamp_visits(서버 적립 기록). 유효기간 밖 카드·미달·중복은 지급하지 않는다.
-- =============================================================================
create or replace function public.complete_stamp_card(p_user uuid, p_card uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card    stamp_cards;
  v_total   integer;
  v_need    integer;
  v_visited integer;
  v_earn    jsonb;
begin
  select * into v_card from stamp_cards where id = p_card and status = 'active';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'card_not_found');
  end if;
  if (v_card.valid_from is not null and now() < v_card.valid_from)
     or (v_card.valid_until is not null and now() > v_card.valid_until) then
    return jsonb_build_object('ok', false, 'error', 'card_expired');
  end if;

  select count(*) into v_total from stamp_card_items where card_id = p_card;
  v_need := coalesce(v_card.required_count, v_total);
  if v_need <= 0 then
    return jsonb_build_object('ok', false, 'error', 'card_empty');
  end if;

  -- 방문 매장 수 — 카드 유효기간 내의 방문만 인정(과거 방문으로 신규 카드 즉시 완성 방지)
  select count(distinct v.partner_id) into v_visited
  from stamp_visits v
  join stamp_card_items i on i.partner_id = v.partner_id and i.card_id = p_card
  where v.user_id = p_user
    and (v_card.valid_from is null or v.created_at >= v_card.valid_from)
    and (v_card.valid_until is null or v.created_at <= v_card.valid_until);

  if v_visited < v_need then
    return jsonb_build_object('ok', false, 'error', 'incomplete',
      'visited', v_visited, 'need', v_need);
  end if;

  -- 이미 받은 카드면 재지급 없이 종료
  if exists (select 1 from stamp_card_completions where user_id = p_user and card_id = p_card) then
    return jsonb_build_object('ok', true, 'granted', 0, 'duplicate', true,
      'balance', points_balance_of(p_user));
  end if;

  v_earn := earn_points(
    p_user, 'stamp_card', v_card.bonus_points,
    'stampcard:' || p_user::text || ':' || p_card::text,
    p_card,
    jsonb_build_object('card', v_card.code)
  );

  insert into stamp_card_completions (user_id, card_id, bonus_granted, coupon_id)
  values (p_user, p_card, coalesce((v_earn->>'granted')::integer, 0), v_card.reward_coupon_id)
  on conflict (user_id, card_id) do nothing;

  return jsonb_build_object('ok', true,
    'granted', coalesce((v_earn->>'granted')::integer, 0),
    'capped', coalesce((v_earn->>'capped')::boolean, false),
    'coupon_id', v_card.reward_coupon_id,
    'balance', points_balance_of(p_user));
end;
$$;

revoke all on function public.complete_stamp_card(uuid, uuid) from public, anon, authenticated;
