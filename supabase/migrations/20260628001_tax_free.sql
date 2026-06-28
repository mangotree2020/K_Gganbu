-- 사후면세 환급 추적 (#26 Phase 2) — 외국인 쇼핑 영수증 누적 → 부가세 환급 예상액 추적.
-- 수동 입력은 클라이언트가 직접 insert(본인 user_id), 스캔은 receipt-ocr Edge Function(service role).
-- RLS는 voice_sessions/passport와 동일한 current_user_id 패턴 → 게스트→로그인 시 데이터 자동 승계.
create table public.tax_free_receipts (
  id            uuid primary key default gen_random_uuid(),
  -- user_id 는 DB 기본값 current_user_id() 로 자동 채움 → 클라이언트는 user_id 미지정 insert.
  user_id       uuid not null default public.current_user_id() references public.users(id) on delete cascade,
  store_name    text,
  purchase_date date,
  total_amount  numeric(12, 2) not null default 0,
  currency      text not null default 'KRW',
  vat_refund    numeric(12, 2) not null default 0,
  image_path    text,
  raw_text      text,
  source        text not null default 'manual' check (source in ('manual', 'scanned')),
  status        text not null default 'saved' check (status in ('saved', 'claimed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_tax_free_user on public.tax_free_receipts(user_id, purchase_date desc);

create trigger trg_tax_free_updated_at before update on public.tax_free_receipts
  for each row execute function public.set_updated_at();

alter table public.tax_free_receipts enable row level security;

-- 본인 데이터만 read/write/delete (수동 입력 지원 → insert/update도 클라이언트 허용).
-- 스캔 경로(service role)는 RLS 우회.
create policy "tax_free_select_own" on public.tax_free_receipts
  for select using (user_id = public.current_user_id());
create policy "tax_free_insert_own" on public.tax_free_receipts
  for insert with check (user_id = public.current_user_id());
create policy "tax_free_update_own" on public.tax_free_receipts
  for update using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());
create policy "tax_free_delete_own" on public.tax_free_receipts
  for delete using (user_id = public.current_user_id());

-- 영수증 이미지 비공개 버킷 — 경로 규약: {auth.uid}/{timestamp}.jpg.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipt-images', 'receipt-images', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "receipt_img_select_own" on storage.objects
  for select to authenticated using (
    bucket_id = 'receipt-images' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "receipt_img_delete_own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'receipt-images' and auth.uid()::text = (storage.foldername(name))[1]
  );
