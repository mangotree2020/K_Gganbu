-- 네이버 블로그 글 개별 노출 (PRD REQ-REV-1 — 기존 REV-3 수급 경로 재사용)
-- 지금까지 블로그 글은 AI 요약 입력으로만 쓰이고 사용자에게 개별로 보이지 않았다.
-- 한국인 관점 리뷰를 목록에도 노출하기 위해 캐시 행에 원문·번역·출처 링크를 함께 저장한다.
-- (검색 API 약관상 출처 링크 노출이 필요하므로 link 를 반드시 보관)
alter table public.place_review_insights add column if not exists naver jsonb;
