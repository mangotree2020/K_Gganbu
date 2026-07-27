-- 파트너 접근 코드 (PRD REQ-PTL-1) — 파트너 포털 인증.
--
-- 왜 별도 코드인가: 파트너에게 `ADMIN_API_KEY` 를 주면 코드 한 장이 유출될 때 **전체 파트너
--   데이터**가 열린다. 매장별 코드를 발급해 유출 반경을 그 매장으로 가둔다(회전도 매장 단위).
-- 저장은 해시만 — DB 를 봐도 코드 원문을 알 수 없다(운영자가 발급 시점에만 원문을 본다).
-- 검증·조회는 전부 Edge Function(service role)에서 하고, 클라이언트가 보낸 partner_id 는
--   신뢰하지 않는다(코드 → partner_id 를 서버가 결정).

create extension if not exists pgcrypto with schema extensions;

create table public.partner_access_codes (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.partners(id) on delete cascade,
  code_hash   text not null unique,              -- sha256(code)
  label       text,                              -- 'counter-1' 등 발급 대상 메모
  status      text not null default 'active' check (status in ('active', 'revoked')),
  last_used_at timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_partner_access_partner on public.partner_access_codes (partner_id, status);

alter table public.partner_access_codes enable row level security;
-- 정책 없음 = anon/authenticated 전면 차단. service role(Edge Function)만 접근한다.

-- 코드 → 파트너 해석 (service role 전용). 유효하지 않으면 null.
create or replace function public.partner_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_partner uuid;
begin
  select c.partner_id into v_partner
  from partner_access_codes c
  join partners p on p.id = c.partner_id
  where c.code_hash = encode(digest(p_code, 'sha256'), 'hex')
    and c.status = 'active'
    and p.status = 'active';

  if v_partner is not null then
    update partner_access_codes
       set last_used_at = now()
     where code_hash = encode(digest(p_code, 'sha256'), 'hex');
  end if;
  return v_partner;
end;
$$;

revoke all on function public.partner_by_code(text) from public, anon, authenticated;

-- 코드 발급 (백오피스에서 호출) — 원문은 반환값으로 한 번만 보여주고 DB 에는 해시만 남는다.
create or replace function public.issue_partner_code(p_partner uuid, p_label text default null)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
begin
  -- 사람이 불러줄 수 있는 길이(12자) — 대소문자 혼동 방지를 위해 소문자+숫자
  v_code := lower(encode(gen_random_bytes(9), 'hex'));
  insert into partner_access_codes (partner_id, code_hash, label)
  values (p_partner, encode(digest(v_code, 'sha256'), 'hex'), p_label);
  return v_code;
end;
$$;

revoke all on function public.issue_partner_code(uuid, text) from public, anon, authenticated;
