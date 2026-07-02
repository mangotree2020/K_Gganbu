-- =============================================================================
-- place_review_insights — 리뷰 AI 요약·번역 캐시 (PRD REQ-REV-1·2, BM§5 S-4)
-- =============================================================================
-- 장소×언어 단위로 AI 요약과 번역된 리뷰를 저장해 사용자 간 재사용한다(변동비 통제).
-- 쓰기/읽기 모두 review-insights Edge Function(service role) 전용 — 클라이언트 정책
-- 없음(캐시 오염 방지). TTL 7일 초과 행은 함수가 재생성한다.
create table public.place_review_insights (
  id         uuid primary key default gen_random_uuid(),
  place_key  text not null,                          -- Google place_id
  lang       text not null,                          -- 앱 언어 (en/ko/ja/zh-CN/zh-TW)
  summary    text not null default '',               -- AI 요약 (해당 언어)
  reviews    jsonb not null default '[]'::jsonb,     -- [{who,flag,score,text,translated,time,lang}]
  rating     numeric,
  total      int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_key, lang)
);

create index idx_place_review_insights_key on public.place_review_insights(place_key, lang);

create trigger trg_place_review_insights_updated_at
  before update on public.place_review_insights
  for each row execute function public.set_updated_at();

alter table public.place_review_insights enable row level security;
-- 정책 없음 = anon/authenticated 접근 불가 (service role만)
