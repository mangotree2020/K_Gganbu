-- 여권 이미지 비공개 버킷 — 쓰기는 passport-ocr Edge Function(service role) 전용.
-- 파일 경로 규약: {auth.uid}/{timestamp}.jpg → 폴더 첫 세그먼트가 본인 식별자.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('passport-images', 'passport-images', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- 본인 폴더만 조회/삭제 (업로드는 service role이 RLS 우회). 방어적 정책.
create policy "passport_img_select_own" on storage.objects
  for select to authenticated using (
    bucket_id = 'passport-images' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "passport_img_delete_own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'passport-images' and auth.uid()::text = (storage.foldername(name))[1]
  );
