-- 후기 사진 (PRD REQ-UGC-2 잔여) — 공개 후기에 붙는 이미지.
-- 여권 버킷과 달리 **공개 버킷**이다: 피드에서 다른 여행자에게 보여야 하고,
--   공개 후기 자체가 명시 동의(is_public) 위에서만 만들어진다.
-- 업로드는 본인 폴더({auth.uid}/...)에만 가능하고, 삭제도 본인 것만 — 방어적 정책.
-- 크기 제한 5MB / 이미지 MIME 만 허용(대용량 업로드로 스토리지 비용이 새지 않도록).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "review_photo_insert_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'review-photos' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "review_photo_delete_own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'review-photos' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- 후기에 붙은 사진 URL (여러 장)
alter table public.reviews add column if not exists photos text[] not null default '{}';
