-- 여권 원본 이미지 미보관 정책 (PRD REQ-PP-3)
-- Vision OCR은 base64 직접 사용 → Storage 보관 자체가 불필요한 민감정보 잔존이었음.
-- passport-ocr 함수는 더 이상 업로드하지 않으며, 기존 보관분은 전량 폐기한다.
alter table public.passport_scans alter column image_path drop not null;

-- 기존 보관 여권 이미지 전량 폐기 (버킷·정책은 유지 — 신규 업로드 없음)
delete from storage.objects where bucket_id = 'passport-images';
