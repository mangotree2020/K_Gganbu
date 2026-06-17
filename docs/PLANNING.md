# K-Gganbu 바이브 코딩 개발 기획서 v2

> 인바운드 여행자(방한 외국인)를 위한 올인원 여행 도우미 앱
> 작성: 신우철 (Mangotree) / 2026-06-12 — GPT·Gemini 기획안 검토 반영판

---

## 1. 프로젝트 이름

**K-Gganbu (K-깐부)**

- 깐부 = 가장 믿을 수 있는 친구·동반자. "한국 여행 중 곁에 있는 현지 친구" 컨셉
- K = Korea / K-Culture / K-Food / K-Travel
- 패키지명: `com.mangotree.kgganbu` / 슬로건: _"Your Korean Best Friend on Trip"_

## 2. 프로젝트 범주

**AI 기반 인바운드 여행자용 통합 여행 도우미 앱 (Travel Super-App / 모바일 컨시어지)**

- 세부: 통역(번역) + Google·Naver 통합 지도 + AI 가이드 + 티켓/쿠폰 + 긴급 도움

## 3. 비전 / 목표

**"한국을 처음 방문한 외국인도 K-Gganbu 하나만 있으면 현지 친구와 함께 여행하는 것처럼 이동하고, 소통하고, 즐길 수 있게 한다."**

- 단기(MVP): 부산 방문 크루즈 관광객·FIT 대상, 핵심 기능(통역/지도/AI 가이드/쿠폰/긴급도움) 출시
- 중기: CruiseYa·HeyBusan 인바운드 사업 연계, 티켓·쿠폰 커머스 수익화
- 장기: 서울·제주·경주 확장, 여행사·호텔·로컬 가이드·관광 사업자가 입점하는 플랫폼화

## 4. 주 사용자

- **1순위**: 중국·대만·일본 FIT 여행객 (20~40대, 단기 체류 3~5일)
- **2순위**: 크루즈 기항지 관광객 (체류 6~10시간, 빠른 의사결정·당일 코스 필요)
- **3순위**: 영어권·동남아 여행객, 외국인 유학생·장기 체류자
- **운영자**: 제휴 상점/투어 업체 (쿠폰·티켓 등록/검증 — 별도 Admin)

## 5. 사용자의 문제 / 불편

1. 구글맵은 한국 도보·대중교통 안내 부정확, 네이버지도는 외국어·UX 장벽 → **지도 이원화 스트레스**
2. 식당·택시·병원·상점에서의 **언어 장벽**
3. 번역 앱 따로, 지도 앱 따로, 쿠폰 앱 따로 — **파편화된 경험**
4. 외국어로 된 신뢰할 만한 로컬 정보(맛집·핫플) 부족
5. 외국인 전용 할인·티켓 발견과 사용이 어려움
6. 긴급 상황(분실·아픔·길 잃음) 시 어디에 물어야 할지 모름
7. 크루즈 관광객: 제한 시간 내 동선 최적화 불가

## 6. 필수 기능 (MVP)

| 기능                    | 설명                                                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **실시간 통역**         | 음성↔음성 = **Gemini 3.5 Live Translate**(Live API, 스트리밍 speech-to-speech, 70+ 언어, 화자 톤·pitch 유지), 텍스트 번역 = Google Cloud Translation, 카메라 OCR(메뉴판/간판), 상황별 회화(식당/택시/호텔/쇼핑/병원), "상대방에게 보여주기" 모드 |
| **K-Map (통합 지도)**   | Google Maps 렌더링 + Naver API 데이터 하이브리드 (→ §17)                                                                                                                                                                                         |
| **AI 깐부 (AI 가이드)** | Claude API 챗봇. 위치·시간 컨텍스트 추천, 일정 생성, 문화 팁, 추천 장소 카드→지도/쿠폰 연결                                                                                                                                                      |
| **티켓/쿠폰 지갑**      | 외국인 전용 쿠폰함, QR 사용 처리, 오프라인에서도 QR 표시. 티켓 판매는 초기 아웃링크 → 2차 인앱 결제                                                                                                                                              |
| **긴급 도움 (SOS)**     | 경찰(112)/병원/대사관/관광통역(1330) 안내, "Help Me" 긴급 문장 생성, 현재 위치 공유, 가까운 병원 찾기                                                                                                                                            |
| **여행 일정 추천**      | 3시간/반나절/1일 코스, 크루즈 기항지 당일 코스, 테마별(가족/커플/K-POP)                                                                                                                                                                          |
| **인증**                | Supabase Auth — Google + Apple + Phone OTP(NHN Cloud SMS). **비회원(Guest) 우선**, WeChat/LINE은 Phase 2                                                                                                                                         |
| **다국어 UI**           | 1차: en / zh-CN / zh-TW / ja / ko → 2차: vi / th / id 확장                                                                                                                                                                                       |

Phase 2+: 택시 호출 연동, T-money 안내, 환율 계산기, 리뷰, 로컬 가이드 매칭, WeChat/LINE 로그인
**MVP 제외**: 유저 커뮤니티(게시판), 자체 결제 시스템(초기엔 외부 예매 아웃링크), 실시간 가이드 매칭

## 7. 사용자의 첫 행동 (Core First Action)

1. 앱 실행 → 언어 자동 감지(기기 locale, 수동 변경 가능)
2. 온보딩: 여행 지역(Busan/Seoul/Jeju…) + 관심사(Food/K-Culture/Shopping/Nature/Cruise…) 선택
3. **가입 없이** 홈 진입 — 핵심 버튼 3개: **Translate Now / Ask AI Gganbu / Find Places**
4. 권한(위치/마이크)은 기능 사용 직전 just-in-time 요청
5. 쿠폰 저장·AI 대화 저장·티켓 시점에 로그인 유도

가장 현실적인 첫 행동: _"한국어를 못하는 상황에서 지금 필요한 문장을 번역하거나, 현재 위치 주변 목적지를 찾는다."_

## 8. 화면 분위기

- **Modern · Friendly · Clean**: 화이트/소프트 그레이 베이스
- 메인 컬러: K-Blue(Turquoise~Deep Blue 계열), 포인트: Warm Yellow/Coral, 강조: Korean Red 소량
- 큰 터치 영역·아이콘 중심(언어 의존 최소화), 야외 시인성, 한 손 조작 최적화
- AI지만 차갑지 않은 "현지 친구" 톤, 다크모드 지원 (NativeWind dark variant)
- **깐부 마스코트(확정)**: Midjourney 제작 캐릭터 — 앱 아이콘, 온보딩, AI 깐부 채팅 아바타, empty state, 로딩 화면에 일관 적용

## 9. UI/UX 참고 서비스

- **Papago**: 통역 마이크 UX, 대화 분할 화면, 보여주기 모드
- **Google Maps / Uber·Grab**: 지도 중심 탐색, 외국인에게 익숙한 맵 조작 패턴
- **Triple**: 동선 중심 일정 레이아웃
- **Klook / KKday / Trip.com**: 티켓·쿠폰 카드 UI, 카테고리 탐색
- **ChatGPT 앱**: 군더더기 없는 AI 채팅 UX
- 구조: 하단 탭 4개 `Home(주변)` / `Map` / `Translate` / `My(쿠폰·티켓)` + **플로팅 AI 깐부 버튼** + 긴급(SOS) 버튼 상시 접근

## 10. 사용 환경

- iOS 15+ / Android 8+ (API 26+)
- 공항·항만·크루즈터미널·관광지·식당·이동 중 — **네트워크 불안정 대응** 필수 (캐싱, retry, 오프라인 QR/회화)
- 로밍/eSIM 저속 환경 → 이미지 최적화, 번들 경량화
- 위치 권한 거부 시에도 기본 기능 동작 (지역 수동 선택 degrade)

## 11. 기술 스택

```
Frontend : React Native (Expo SDK 52+) + Expo Router v4 + TypeScript
Styling  : NativeWind v4
State    : Zustand (client) + TanStack Query v5 (server)
Form     : React Hook Form + Zod
Network  : Axios + supabase-js (자동 토큰 refresh)
Auth     : Supabase Auth (Google/Apple/Phone OTP) — RLS 연동, Guest(anonymous) 지원
Backend  : Supabase (PostgreSQL + RLS + Edge Functions)
           서버 로직은 Edge Functions(Deno) 우선, 복잡 업무 발생 시 별도 API 서버 검토
DB       : Supabase PostgreSQL (관리형) → 향후 트래픽/요건 증가 시
           self-hosted PostgreSQL 확장·이관 고려 (표준 PG라 이관 용이)
AI       : Claude API (AI 깐부 챗봇 — 페르소나 §18), 텍스트 번역: Google Cloud Translation 단독
Voice    : Gemini 3.5 Live Translate (Live API, gemini-3.5-live-translate-preview)
           — 음성↔음성 실시간 통역. 16kHz PCM in / 24kHz audio out, targetLanguageCode 설정
           OCR 번역은 Google Cloud Vision + 텍스트 번역 API 연계
Maps     : Google Maps SDK (렌더링) + Naver Cloud Maps/Search/Directions API (데이터) — §17
Push     : Firebase FCM (Firebase는 FCM 등 필요 기능만 한정 사용)
Storage  : Supabase Storage (이미지·파일)
Analytics: Firebase Analytics + Sentry (crash/에러)
Infra    : Supabase 관리형 + 자체 Linux 서버(배치/관리 도구)
Dev      : Claude Code, CLAUDE.md 기반 컨텍스트, feature-folder 구조, mock-first 개발
```

## 12. 데이터 저장 방식

- **서버**: Supabase PostgreSQL — 테이블별 RLS 정책 적용 (스키마 §20)
- **파일**: Supabase Storage (프로필·쿠폰 이미지, POI 사진)
- **확장 계획**: 데이터/트래픽 증가 시 self-hosted PostgreSQL 이관 또는 하이브리드 (pg_dump / logical replication)
- **로컬**: MMKV (Supabase 세션·설정·선택 언어), TanStack Query persist (POI/쿠폰 캐시), 오프라인 회화·긴급 문장은 앱 내 번들 탑재, 쿠폰 QR 로컬 보관
- **개인정보 원칙**: 이메일/전화번호/언어/국적(선택)만 수집, 위치는 명시 동의 후, AI 대화 내 개인정보 저장 최소화

## 13. 외부 연동 API

| 서비스                                                               | 용도                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Supabase                                                             | Auth(Google/Apple/Phone/Anonymous), DB, Storage, Edge Functions, Realtime |
| NHN Cloud SMS                                                        | OTP 발송 (Supabase custom SMS provider)                                   |
| Firebase                                                             | **FCM 푸시 + Analytics 한정** (Auth/DB 미사용)                            |
| Google Maps Platform                                                 | 지도 렌더링, Places(글로벌), Geocoding                                    |
| Naver Cloud                                                          | Maps/Search/Directions/Geocoding — 국내 POI·대중교통·경로                 |
| Google Cloud Translation                                             | 텍스트 번역 (단독 사용)                                                   |
| **Gemini 3.5 Live Translate**                                        | 음성↔음성 실시간 통역 (Live API, 70+ 언어) — §25                          |
| Google Cloud Vision                                                  | 카메라 OCR (메뉴판/간판 텍스트 추출)                                      |
| Claude API                                                           | AI 깐부                                                                   |
| 한국관광공사 TourAPI 4.0                                             | 다국어 관광지·축제·음식점 데이터 (무료)                                   |
| 날씨 API (기상청/OpenWeather) · 환율 API                             | 홈 위젯·AI 컨텍스트                                                       |
| (Phase 2) 결제 라우팅 — Eximbay/Toss(1차) + Stripe·코나플레이트(2차) | 인앱 결제, §24 참조                                                       |
| (Phase 2) Kakao T / WeChat Pay·Alipay                                | 택시·결제                                                                 |

## 14. 가장 중요한 가치

1. **즉시성** — 가입 없이 3초 안에 번역·지도·도움 요청
2. **신뢰성** — 오역·잘못된 길안내는 여행을 망침. AI 답변은 검증 가능한 데이터(RAG) 기반
3. **현지성** — 한국식 교통·식당·결제 문화를 이해하고 안내하는 "로컬 친구"
4. **심리스** — 통역→지도→쿠폰→AI가 한 흐름으로 연결 (파편화 해소)

(완벽한 구조보다 **동작하는 MVP 우선**, 빠른 배포-개선 사이클)

## 15. 테스트 / 품질

**테스트 기준**

1. 첫 실행 10초 안에 핵심 기능 이해 가능해야 함
2. 통역은 식당/택시/호텔/쇼핑/병원 실제 상황 시나리오로 테스트
3. K-Map은 Google vs Naver 결과 차이 비교 검증
4. 위치 권한 거부·약한 네트워크에서도 앱이 멈추지 않아야 함 (네트워크 스로틀 테스트)
5. 쿠폰/티켓 QR은 오프라인에서 표시 가능해야 함
6. AI는 의료·법률·비자 정보를 단정하지 않고 공식 안내처(1330 등) 연결
7. 언어별(특히 zh/ja 장문) UI 레이아웃 깨짐 검증
8. iOS/Android 동일 핵심 경험 — 실기기(iPhone + 중저가 Android) 테스트

- 도구: Jest(비즈니스 로직 — 쿠폰 검증·i18n 포맷), 수동 QA 체크리스트, TestFlight/내부 트랙 베타(학생 멘티 팀 활용), Sentry
- **외국인 사용자 테스트: 일본 우선(확정)** — 거리 FIT 70% + 크루즈 30% 시나리오, ja 로컬라이징 네이티브 검수 필수
- 100% 커버리지보다 **핵심 경로 안정성** 우선

**품질 지표(KPI)**: 첫 실행→핵심 기능 사용 시간, 번역 성공률, 지도 검색 성공률, AI 응답 만족도, 쿠폰 다운로드율, 재방문율, crash-free rate, 위치 권한 허용률

## 16. 용어 / 약어 사전

| 용어                      | 의미                        |
| ------------------------- | --------------------------- |
| KGB                       | K-Gganbu 내부 코드네임      |
| AI 깐부 (AI-Gganbu)       | AI 가이드 챗봇 기능명       |
| K-Map                     | Google+Naver 통합 지도 모듈 |
| 쿠폰함 (Travel Wallet)    | My 탭 내 쿠폰·티켓 지갑     |
| SOS / Help Me             | 긴급 도움 기능              |
| POI                       | Point of Interest           |
| FIT                       | Free Independent Traveler   |
| Guest                     | 비로그인(anonymous) 사용자  |
| 파트너 (Partner/Merchant) | 쿠폰·티켓 제휴 업체         |
| Local Picks               | 현지인 추천 큐레이션        |
| i18n                      | 다국어 처리                 |
| OTP                       | One-Time Password 전화 인증 |

---

# 아키텍처 상세

## 17. K-Map 하이브리드 지도 아키텍처

- **렌더링 레이어**: Google Maps SDK — 외국인에게 익숙한 조작감·글로벌 장소 인식
- **데이터 레이어**: Naver Cloud API — 국내 장소 검색·대중교통·도보 경로의 정확도
- 동작: 목적지 검색/길찾기 요청 → **Edge Function이 Naver API 호출(확정 — 키 보호·좌표 변환·캐싱 일괄 처리)** → 결과 좌표를 **Google Map 위에 Polyline·Marker로 오버레이**
- 좌표계 변환 유의 (Naver 일부 API의 TM128 ↔ WGS84), `google_place_id`·`naver_place_id` 양쪽 보관해 상호 매핑
- 비교 모드: 사용자가 Google 결과 / Naver 결과를 전환 비교 가능
- 캐시: 마지막 조회 지역 POI 24h 캐시, 즐겨찾기는 오프라인 보관
- **지도 라벨 다국어**: 베이스맵 라벨·오버레이 POI 모두 앱 설정 언어(`useLocaleStore.lang`)를 따른다.
  - 두 지도 모두 **WebView + JS API**로 렌더링(`src/features/map/{NaverMap,GoogleMap}.tsx`), 동일 핸들(`moveTo/drawRoute/clearRoute`)·마커 데이터 공유
  - Naver: 스크립트 URL에 `&language=` 부착(`ko/en/ja/zh`만 지원 → 중문 간/번체는 `zh`로 통합)
  - Google: Maps JavaScript API 스크립트 URL에 `&language=`(BCP-47 그대로: en/ko/ja/zh-CN/zh-TW). react-native-maps는 per-component 언어 prop이 없어 네이티브 대신 WebView 채택 → 런타임 완전 제어
  - 언어 변경 시 HTML 재생성으로 즉시 반영, 오버레이 POI도 언어별 TourAPI(`useMapPois(lang)`)로 현지화
  - **키 요건(중요)**: WebView는 `baseUrl: https://localhost` origin으로 로드되므로 각 지도 키가 이 리퍼러를 허용해야 한다.
    - Naver: NCP 콘솔 "Web 서비스 URL"에 `https://localhost` 등록(앱 패키지명 아님)
    - Google: Cloud Console에서 **Maps JavaScript API 활성** + 키의 HTTP 리퍼러에 `https://localhost/*` 허용. Android 앱 제한(SHA-1) 키는 JS API에서 동작 안 함 → 브라우저 키 분리 권장(`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`)

## 18. AI 깐부 페르소나 & 가드레일

- 페르소나: **"한국을 잘 아는 유쾌하고 친절한 로컬 친구"** — 백과사전식 말투 금지, 사용자 언어로 응답
- 컨텍스트 주입: 현재 위치, 시간대, 날씨, 사용자 언어·관심사·체류 일정, 대화 이력
- RAG: TourAPI + 자체 큐레이션 DB(부산 맛집/크루즈 기항지 코스) — 환각 방지, 추천은 카드 UI로 지도·쿠폰 연결
- 가드레일: 의료·법률·비자는 단정 금지 → 1330(관광통역)/112/119/대사관 안내. 위급 키워드("lost my wallet" 등) 감지 시 즉시 SOS 플로우 제안
- 기능 호출: "일정 만들어줘" → 일정 생성, "한국어로 보여줄 문장" → 보여주기 카드 생성

## 19. 화면 구성 (Expo Router 매핑)

```
app/
├─ (onboarding)/language, region, interests     # 언어→지역→관심사
├─ (tabs)/
│   ├─ index            # Home: 3대 버튼 + 주변 추천 + 날씨/환율 위젯
│   ├─ map              # K-Map (검색/길찾기/비교/저장)
│   ├─ translate        # 통역 (음성/텍스트/OCR/상황별 회화/보여주기)
│   └─ my               # 쿠폰함·티켓·즐겨찾기·일정·설정
├─ gganbu/              # AI 깐부 채팅 (플로팅 버튼 → 모달/스택)
├─ coupon/[id]          # 쿠폰 상세 + QR
├─ ticket/[id]          # 티켓 상세 (초기 아웃링크)
├─ itinerary/           # 일정 추천·생성
├─ emergency/           # SOS (긴급 문장/연락처/병원/위치 공유)
└─ auth/                # 로그인 (Google/Apple/Phone)
```

- feature 폴더: `features/{auth,map,translate,gganbu,coupon,itinerary,emergency}` — 각 feature에 `components/ hooks/ services/ types/`
- 서비스 레이어 분리: mock → 실 API 교체 가능 구조 (mock-first)

### 19.1 홈 화면 인터랙션 정의 (디자인 HomeV2 "Daybreak" 기준, 2026-06-18)

`docs/K-Gganbu (standalone).html`의 HomeV2를 충실 구현하고, 디자인의 모든 탭 요소를 실 라우트로 연결한다.

| 요소                                                      | 동작                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| 프로필 아이콘(우상단)                                     | → `(tabs)/profile`                                                   |
| 알림 아이콘·위치 핀(좌상단)                               | 표시 전용(배지 3) — 알림 화면은 Phase 2                              |
| 검색바 KO 버튼                                            | → `translate`                                                        |
| 코어 액션 Translate/AskAI/Find                            | → `translate` / `(tabs)/ai` / `(tabs)/map`                           |
| AI 깐부 카드                                              | → `(tabs)/ai` (회전 프롬프트 4종)                                    |
| 퀵타일 Translate/Coupons/Cruise/Allergy/Payment/Emergency | → `translate`·`(tabs)/coupons`·`cruise`·`allergy`·`tips`·`emergency` |
| Today's pick 카드                                         | → `place` (장소 상세)                                                |
| Nearby now "See all" / 카드                               | → `(tabs)/map` / `place` (카드는 실 TourAPI POI, 없으면 샘플)        |
| Today's deals "See all"·배너                              | → `(tabs)/coupons`                                                   |
| Recommended courses "See all"·카드                        | → `itinerary` (크루즈 코스는 `cruise`)                               |
| From travelers "See all"                                  | → `reviews`                                                          |

## 20. 데이터 모델 (Supabase 초기 스키마)

```
users            id, auth_id(supabase), anonymous_id, email, provider,
                 nationality, preferred_language, travel_region,
                 interests[], party_type, created_at, last_active_at
places           id, name, name_i18n(jsonb), category, address, lat, lng,
                 google_place_id, naver_place_id, description_i18n(jsonb),
                 tags[], image_url, source(tourapi|curated|partner)
coupons          id, title_i18n, partner_id, discount_type, discount_value,
                 valid_from, valid_until, usage_condition_i18n,
                 place_id, status
coupon_issues    id, coupon_id, user_id, qr_token, issued_at,
                 used_at, used_location, status        # one-time QR (TTL 5분)
tickets          id, title_i18n, category, price, currency, provider_id,
                 outlink_url, qr_voucher, status
partners         id, name, contact, place_id, settlement_info, status
ai_chat_logs     id, user_id, language, question, answer_summary,
                 location_context, created_at
favorites        id, user_id, place_id, type, created_at
itineraries      id, user_id, title, region, duration, items(jsonb), created_at
emergency_phrases id, category, source_text, translations(jsonb), priority
```

- 전 테이블 RLS: 본인 데이터만 read/write, 쿠폰 검증·소멸은 **Edge Function(service role)** 전용
- 다국어 콘텐츠는 jsonb `{en, zh-CN, zh-TW, ja, ko}` 패턴

---

# MVP 로드맵

## Phase 1 — 핵심 사용성 검증 (8~10주, 부산)

언어/지역/관심사 온보딩 · 홈(3대 버튼) · 텍스트 번역 + 음성 통역 기본형 · AI 깐부 기본(RAG 1차) · K-Map(검색/길찾기/즐겨찾기) · 쿠폰함(저장/QR) · 긴급 도움 · 기본 회화 · Guest 모드 + Supabase Auth
**제외**: 결제, 예약, 커뮤니티, 가이드 매칭, Admin 전체

> **구현 현황 (2026-06-17)**: Phase 1 백로그 #1~#25 **코드 구현 완료** (상세: `docs/BACKLOG.md` 진행 현황표).
> ✅ 온보딩·홈·번역(텍스트/회화/OCR)·K-Map·쿠폰·긴급·Guest 동작 검증 완료.
> 🔶 외부 설정 대기: 소셜 로그인(#8) · 전화 OTP(#9) · 음성통역 Agent(#16) · 실 번역/AI/Naver 키(#14·#22·#19).
> ja 네이티브 검수: `docs/I18N_JA_REVIEW.md` 1차 자체 리뷰 완료 → ⚠️ 5건 원어민 확정 대기.

## Phase 2 — 커머스·콘텐츠 확장 (+4~6주)

카메라 OCR 번역 · AI 일정 생성 고도화 · 쿠폰/티켓 상세·카테고리 · 티켓 아웃링크→**결제 라우팅 플랫폼(§24: Eximbay/Toss 1차)** · 추천 코스(크루즈 기항지 포함) · 푸시(FCM) · Admin 기본형(파트너 쿠폰 등록) · 콘텐츠 자동 번역 파이프라인

> **구현 현황 (2026-06-17)**: ✅ 카메라 OCR 번역(mock-first) · ✅ 추천 코스(`app/itinerary.tsx`, §6 "여행 일정 추천" 겸함) · ✅ AI 일정 생성(§18 "일정 만들어줘" — gganbu RAG, mock-first) · ✅ 티켓 카테고리·아웃링크(`app/tickets.tsx`).
> ✅ 결제 라우팅 추상화(§24 — `features/payment/`: selectProvider 규칙·어댑터·payment-router 계약, mock-first + 단위테스트). 실 PG(Eximbay/Toss/Stripe/코나) 키·webhook은 외부 설정 대기.
> ✅ 푸시 opt-in 클라이언트 추상화(§11 — `features/notifications/`: 권한·토큰·등록 계약 mock-first, profile 알림 토글 MMKV persist). 실 전송은 `@react-native-firebase/messaging`(미설치) + Firebase FCM 설정 대기.
> ✅ 콘텐츠 자동 번역 파이프라인(`supabase/functions/translate-content` — 소스 텍스트 → 5개 로케일 jsonb 자동 채움).
> ✅ Admin 기본형 백엔드(`supabase/functions/partner-coupon` — 파트너 쿠폰 등록/목록, ADMIN_API_KEY 게이트). **Admin UI는 별도 앱**(이 RN 저장소 밖).
>
> **Phase 2 결론**: 이 저장소에서 구현 가능한 항목 전부 완료. 남은 작업은 외부 키/설정(SETUP_EXTERNAL) 또는 별도 Admin 앱 구축.

## Phase 3 — 플랫폼화

로컬 가이드 매칭 · 여행사/호텔 상품 연동 · **Stripe(해외 법인 정산) + 코나플레이트 선불카드(충전→오프라인 제휴 매장 결제)** · 리뷰 · B2B 제휴 대시보드 · 다국가 마케팅 랜딩 · 데이터 기반 관광 리포트 · vi/th/id 언어 확장 · WeChat/LINE 로그인

> **구현 현황 (2026-06-17)**: ✅ 리뷰(`app/reviews.tsx` — 내 리뷰 목록, mock-first). Stripe/코나 정산은 결제 라우팅 어댑터(§24, 어댑터 stub 완료)에 키 연결.
> 미착수(플랫폼·외부 파트너/인프라 의존): 로컬 가이드 매칭 · 여행사/호텔 연동 · B2B 대시보드 · 마케팅 랜딩 · 데이터 리포트 · vi/th/id 언어 확장(2차) · WeChat/LINE 로그인.

---

# 사업 / 운영

## 21. 수익 모델 (우선순위)

1. 티켓/쿠폰 판매 수수료 (제휴처 10~15%)
2. 파트너 광고·상위 노출 (지도/홈 추천)
3. CruiseYa 크루즈 상품 크로스셀, 여행사 리드
4. (검토) AI 깐부 무제한 구독

## 22. 쿠폰 부정사용 방지

- QR = Edge Function 발급 one-time token (TTL 5분), 파트너 검증 호출 시 즉시 소멸
- 검증·소멸은 RLS 우회 필요 → **Edge Function(service role)** 에서만 처리
- 기기당 발급 제한 + 사용 로그(시간/위치)

## 23. 앱스토어 / 배포 리스크

- Apple: 소셜 로그인 제공 시 Sign in with Apple 필수 → 포함 ✓
- 중국 본토 배포는 ICP 등 별도 이슈 → 1차는 App Store(대만/홍콩/일본/글로벌) + Google Play
- 백그라운드 위치 미사용 → 심사 단순화

---

# 바이브 코딩 개발 지시문 (CLAUDE.md용 요약)

```
K-Gganbu: 방한 외국인 FIT·크루즈 관광객용 AI 여행 도우미 앱.
Stack: Expo SDK 52+ / Expo Router v4 / TypeScript / NativeWind v4 /
Zustand / TanStack Query v5 / RHF+Zod / supabase-js.
Auth: Supabase Auth (Google·Apple·Phone OTP·Anonymous). Guest 우선,
쿠폰 저장 시점 로그인 유도. Firebase는 FCM·Analytics 전용.
구조: app/(tabs) 4탭(Home/Map/Translate/My) + 플로팅 AI 깐부 +
emergency 스택. features/{auth,map,translate,gganbu,coupon,
itinerary,emergency} — 각 feature에 components/hooks/services/types.
원칙:
- mock-first: services 레이어에 mock 구현 먼저, 실 API 교체 가능 구조
- i18n: en/zh-CN/zh-TW/ja/ko, 모든 사용자 노출 문자열은 i18n 키 사용
  (일본 사용자 테스트 우선 — ja 품질 최우선)
- 권한(위치/마이크/카메라)은 just-in-time 요청, 거부 시 degrade 동작
- 네트워크 실패 시 친절한 안내 + retry, 핵심 데이터 캐시
- K-Map: 외부 API(Naver/Google Places)는 반드시 Edge Function 경유,
  Google Map 렌더링 위에 결과를 Polyline/Marker 오버레이
- 음성 통역은 Phase 1 범위 — Gemini 3.5 Live Translate(Live API,
  gemini-3.5-live-translate-preview) 사용. 미디어 스트리밍은
  LiveKit(@livekit/react-native)으로 처리, 토큰(LiveKit+Gemini)은
  Edge Function 발급. preview 단계이므로 상황별 회화·텍스트 번역을
  폴백으로 항상 제공
- 결제는 provider 추상화: services/payment/{provider}.ts 어댑터 패턴,
  앱은 payment-router Edge Function만 호출
- AI 깐부 페르소나: 유쾌한 로컬 친구(마스코트 아바타),
  의료/법률/비자 단정 금지 → 1330 안내
- DB 변경은 Supabase migration 파일로, 전 테이블 RLS 필수
첫 작업: 온보딩(언어/지역/관심사) → 홈(3대 버튼) → 탭 레이아웃
보일러플레이트를 mock 데이터로 구현.
```

---

# 확정 결정 사항 (2026-06-12)

1. **음성 통역 Phase 1 포함** — 텍스트 번역과 함께 MVP 핵심. STT/TTS 파이프라인을 초기 스프린트에 배치
2. **Naver API는 Edge Function 경유** — API 키 보호 + 응답 정규화(좌표 변환·캐싱)를 서버에서 일괄 처리
3. **결제는 단일 PG가 아닌 "결제 라우팅 플랫폼"** — 한국 법인·해외 법인·코나 선불카드를 모두 수용 (§24)
   - 1차: Eximbay vs Toss Payments 비교 도입 (해외카드 직수용)
   - 2차: Stripe(해외 법인 정산) + 코나아이 코나플레이트(선불카드 발급·충전)
4. **첫 사용자 테스트 국가: 일본** — 거리 기반 FIT 70% + 크루즈 관광객 30% 비중으로 시나리오 구성. ja 로컬라이징 품질 최우선
5. **브랜드 톤: 친근 캐릭터형** — 깐부 마스코트 적용, Midjourney로 제작 (계정 보유). 앱 아이콘·온보딩·AI 깐부 채팅 아바타·빈 화면(empty state)에 활용

## 24. 결제 라우팅 플랫폼 아키텍처 (Phase 2)

```
앱 → Edge Function: payment-router
        ├─ 라우팅 규칙 (카드 국가/통화/결제수단/제휴 조건)
        ├─ Eximbay 또는 Toss   : 해외 발행 카드, 국내 정산 (1차)
        ├─ Stripe              : 해외 법인 정산 필요 상품 (2차)
        └─ 코나플레이트         : 코나 선불카드 발급·충전·결제 (2차)
DB: payments(id, user_id, ticket_id, provider, amount, currency,
    pg_tx_id, routing_reason, status, created_at) — provider 무관 단일 원장
```

- 결제 요청·검증·webhook 수신은 모두 Edge Function에서 처리, 앱은 provider를 모름 (추상화)
- provider별 어댑터 패턴: `services/payment/{eximbay,toss,stripe,konaplate}.ts` — 추가/교체 용이
- 환불·정산 리포트도 단일 원장 기준으로 통합
- 코나 선불카드: 외국인 관광객 충전형 카드 → 오프라인 제휴 매장 결제까지 확장 가능한 차별화 포인트

## 25. 실시간 음성 통역 아키텍처 (Gemini 3.5 Live Translate)

- 모델: `gemini-3.5-live-translate-preview` (Gemini Live API). 2026-06-09 출시, preview 단계
- 동작: 스트리밍 speech-to-speech — 음성 입력 → 번역 음성 출력이 화자보다 몇 초 뒤따라 연속 생성 (turn-by-turn 아님). 화자의 억양·pace·pitch 유지, 70+ 언어 자동 감지
- 오디오 포맷: **입력 16kHz PCM / 출력 24kHz audio**. 설정 파라미터: `targetLanguageCode`, `echoTargetLanguage`
- 연결 구조:

```
앱(마이크) → LiveKit Room(WebRTC) → Agent → Gemini Live API
        ↑ 번역 음성(24kHz) + optional transcript ↓
토큰 발급: Edge Function (LiveKit access token + Gemini 세션)
```

- RN 구현: 실시간 미디어 스트리밍은 **LiveKit(확정)** 으로 처리 — Google 공식 통합 파트너, WebRTC 기반. `@livekit/react-native` + Live API 연동. 미디어 파이프라인(에코 캔슬·지터 버퍼·재연결)을 LiveKit이 담당하므로 앱은 UX에 집중
- API 키는 클라이언트 노출 금지 → **LiveKit access token + Gemini 세션 토큰 모두 Edge Function에서 발급**
- 대화 모드 UX: Papago식 분할 화면 + "보여주기" 모드. 양방향 자동 감지로 ko↔ja/zh/en 핸즈프리(이어폰) 지원
- 주의/리스크:
  - preview 단계 → 가용성·요금·쿼터 변동 가능, 출시 일정에 버퍼 확보
  - 모델 한계(공식 명시): 긴 침묵 후 음성 톤 변동, 비원어민 억양·유사 언어 감지 오류, 소음 환경 일부 한계 → **상황별 회화·텍스트 번역을 폴백**으로 항상 제공
  - 모든 출력 음성에 SynthID 워터마크 포함

# 다음 단계

1. 본 문서를 `K_Gganbu/docs/PLANNING.md` 저장, CLAUDE.md에서 참조
2. Supabase 프로젝트: Auth provider 설정 + §20 스키마/RLS migration 작성
3. Figma 와이어프레임: 온보딩 3장 + 탭 4화면 + AI 깐부 + SOS (7화면)
4. **깐부 마스코트 Midjourney 제작**: 캐릭터 시트(정면/표정 4종/포즈) → 앱 아이콘·아바타·empty state 에셋 추출
5. TourAPI 키 발급, Naver Cloud/Google Maps 빌링, Firebase FCM 전용 프로젝트 구성
6. Phase 1 백로그를 GitHub Issues로 분해 (Claude Code 작업 단위)
