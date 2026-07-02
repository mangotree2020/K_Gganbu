-- place_review_insights.sources — 요약에 반영된 소스별 건수 {google, naver}
-- 네이버 블로그 리뷰(공식 검색 API) 소스 추가에 따른 확장 (REQ-REV-3·4)
alter table public.place_review_insights
  add column sources jsonb not null default '{}'::jsonb;
