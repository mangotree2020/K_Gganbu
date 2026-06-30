# K-Gganbu Phase 1 MVP 백로그

> `docs/PLANNING.md` Phase 1(§240) 범위 기준 GitHub Issues 백로그
> 부산 FIT·크루즈 관광객 대상 핵심 사용성 검증 (8~10주)

## 원칙

- **mock-first**: 모든 외부 연동 기능은 `services/` 레이어에 mock 구현을 먼저 완료한 뒤 실 API로 교체한다. mock Issue 완료 → 화면/플로우 동작 검증 → 실 API Issue 착수.
- **의존성 순서**: 아래 Issue는 번호 순으로 착수 가능하도록 정렬했다. **의존성** 필드의 Issue가 완료(merge)돼야 해당 Issue 착수가 가능하다.
- **라벨**: `feature/auth` · `feature/map` · `feature/translate` · `feature/gganbu` · `feature/coupon` · `feature/emergency` · `feature/infra` · `feature/ui`

## Phase 1 제외 (백로그 미포함)

결제·예약·티켓 인앱 결제 / 유저 커뮤니티 / 로컬 가이드 매칭 / 파트너 Admin 전체 / 카메라 OCR / AI 일정 생성 고도화 / 푸시(FCM)

## 의존성 흐름 요약

```
인프라(#1~#6) ──┬─→ 인증(#7~#9) ──┐
                ├─→ 온보딩(#10~#11)─┤
                └─→ 홈(#12) ────────┤
                                     ├─→ 번역(#13~#16)
                                     ├─→ K-Map(#17~#20)
                                     ├─→ AI 깐부(#21~#22)
                                     ├─→ 쿠폰함(#23~#24)
                                     └─→ 긴급 도움(#25)
```

## 진행 현황 (2026-06-24 기준, 06-18~22 작업 반영)

> Phase 1 백로그 **25개 항목 코드 구현 완료** (완료 조건 체크박스 전수 충족).
> 일부 항목은 코드 완료 상태이며, 실제 동작에는 외부 키·대시보드 설정이 추가로 필요(🔶).
>
> **06-18~22 추가 진척**: #16 음성통역 B안 직결(`geminiLive.ts`) 구현 — 무음 튜닝·에코 차단·자동 재연결·언어감지 폴백까지 완료(잔여: `GEMINI_API_KEY`+네이티브 PCM 마이크). #8 OAuth 콜백 딥링크·리다이렉트·가드 정비(잔여: Supabase provider). #19 Naver 구형 API 폴백 제거 + 지도 리뷰 Google Places 실데이터·출처 필터. #12 홈 실시간 날씨·동적 배경·AI 컨텍스트 인사·TTS. #21·#22 AI 깐부 음성 질답·사투리·대화이력(MMKV) 강화.
>
> **구조 변경**: 탭이 `index/map/translate/ai/coupons/profile`로 확장 — 통역·AI 깐부 독립 탭 승격, 쿠폰+티켓을 CouTix 단일 탭 통합(상세: `docs/PLANNING.md` Phase 1 현황).

**범례**: ✅ 구현 완료·검증 · 🔶 코드 완료 · 외부 설정 시 동작

| #   | 항목                 | 상태 | 비고                                                                                                                                                                                                              |
| --- | -------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1  | 프로젝트 초기 셋업   | ✅   | Expo Router·NativeWind·alias·lint 베이스라인                                                                                                                                                                      |
| #2  | Supabase 스키마·RLS  | ✅   | migration 5종 + 전 테이블 RLS                                                                                                                                                                                     |
| #3  | mock 서비스 레이어   | ✅   | USE_MOCK 토글 + withRetry 래퍼                                                                                                                                                                                    |
| #4  | 다국어(i18n) 기반    | ✅   | 5개 언어 + ja 1차 자체 검수(`I18N_JA_REVIEW.md`)                                                                                                                                                                  |
| #5  | 공통 UI·마스코트     | ✅   | Button/Card/Sheet/EmptyState + brand                                                                                                                                                                              |
| #6  | 탭+플로팅 AI+SOS     | ✅   | 4탭 셸 + 전역 진입점                                                                                                                                                                                              |
| #7  | Guest 모드           | ✅   | 익명 세션 + linkIdentity 승계                                                                                                                                                                                     |
| #8  | 소셜 로그인          | 🔶   | 코드 완료 / Supabase Google·Apple provider 설정                                                                                                                                                                   |
| #9  | 전화 OTP             | 🔶   | 코드 완료 / NHN Cloud SMS provider 설정                                                                                                                                                                           |
| #10 | 온보딩 — 언어        | ✅   |                                                                                                                                                                                                                   |
| #11 | 온보딩 — 지역·관심사 | ✅   |                                                                                                                                                                                                                   |
| #12 | 홈 — 3대 버튼·위젯   | ✅   |                                                                                                                                                                                                                   |
| #13 | 텍스트 번역 mock     | ✅   |                                                                                                                                                                                                                   |
| #14 | 텍스트 번역 실 API   | ✅   | Google Translation 단독(§11) — 2026-06-30 실 호출 검증(provider:google, en↔ko 정상)                                                                                                                               |
| #15 | 상황별 회화·보여주기 | ✅   | 오프라인 번들                                                                                                                                                                                                     |
| #16 | 음성 통역            | 🔶   | B안 직결(`geminiLive.ts`) / 서버 `GEMINI_API_KEY` 미설정(`gemini-live-token`→no_key), 단 클라이언트 `EXPO_PUBLIC_GEMINI_KEY`(DEV_KEY)로 직결 동작 — ephemeral이라 프로덕션은 서버 발급 필요 + 네이티브 PCM 마이크 |
| #17 | K-Map 렌더링         | ✅   |                                                                                                                                                                                                                   |
| #18 | K-Map POI 검색 mock  | ✅   |                                                                                                                                                                                                                   |
| #19 | K-Map 길찾기·Naver   | ✅   | 2026-06-30 실 호출 검증 — naver-search(실 POI)·naver-directions(경로 259점·TM128→WGS84)·places·place-reviews 모두 200                                                                                             |
| #20 | K-Map 즐겨찾기       | ✅   |                                                                                                                                                                                                                   |
| #21 | AI 깐부 채팅 mock    | ✅   |                                                                                                                                                                                                                   |
| #22 | AI 깐부 Claude·RAG   | ✅   | 2026-06-30 실 호출 검증 — gganbu→실 Claude 응답(부산 컨텍스트 반영). TourAPI RAG 컨텍스트 포함                                                                                                                    |
| #23 | 쿠폰함 저장·목록     | ✅   |                                                                                                                                                                                                                   |
| #24 | 쿠폰 QR one-time     | ✅   |                                                                                                                                                                                                                   |
| #25 | 긴급 도움(SOS)       | ✅   | 오프라인 동작                                                                                                                                                                                                     |

> **키 연동 검증 (2026-06-30)**: USE_MOCK 미설정 = real 모드. Edge Function 14종 전부 ACTIVE.
> 실 호출 검증 ✅ — translate(Google)·gganbu(Claude)·naver-search·naver-directions·places·place-reviews.
> 미설정 ⛔ — 서버 `GEMINI_API_KEY`(#16, 클라이언트 DEV_KEY로 우회 동작). 미검증(외부/대면 필요) — #8 소셜·#9 OTP.
> 🔶 항목 외부 설정 절차는 **`docs/SETUP_EXTERNAL.md`** 참조 (시크릿 이름·발급처·검증 포함).
> ja 네이티브 검수는 `docs/I18N_JA_REVIEW.md`의 ⚠️ 5건 우선 진행.

---

## [#1] 프로젝트 초기 셋업 (Expo SDK 52 + 폴더 구조)

**라벨**: feature/infra
**의존성**: 없음
**범위**: Expo Router v4 · TypeScript · NativeWind v4 · feature-folder 구조 · 코드 컨벤션(2-space, no-semi) 베이스라인 구축

**완료 조건**

- [x] `app/(tabs)`, `features/{auth,map,translate,gganbu,coupon,itinerary,emergency}`, `lib/`, `components/ui/` 디렉터리 스캐폴딩
- [x] Path alias(`@/ui`, `@/features`, `@/lib`, `@/hooks`, `@/utils`) tsconfig·babel 설정
- [x] NativeWind v4 + tailwind 토큰(K-Blue/Warm Yellow/Coral) 적용 및 dark variant 동작
- [x] ESLint·Prettier·type-check 스크립트 통과
- [x] `.env.example`에 필요한 환경변수 키 정의

## [#2] Supabase 스키마 & RLS 마이그레이션

**라벨**: feature/infra
**의존성**: #1
**범위**: PLANNING §20 초기 스키마(users, places, coupons, coupon_issues, favorites, emergency_phrases 등)를 migration 파일로 작성하고 전 테이블 RLS 적용

**완료 조건**

- [x] §20 테이블 migration 파일 작성 및 적용
- [x] 전 테이블 `auth.uid()` 기반 RLS 정책(본인 데이터만 read/write) 설정
- [x] 다국어 jsonb(`{en,zh-CN,zh-TW,ja,ko}`) 컬럼 패턴 적용
- [x] supabase-js 클라이언트(`lib/supabase.ts`) + 세션 MMKV 저장 구성
- [x] 로컬/원격 schema 일치 검증

## [#3] mock 서비스 레이어 추상화 패턴

**라벨**: feature/infra
**의존성**: #1
**범위**: feature별 `services/` 인터페이스 정의와 mock·real 구현 교체 가능한 어댑터 패턴 확립 (mock-first 기반)

**완료 조건**

- [x] feature별 `services/index.ts` 인터페이스 + `mock.ts`/`real.ts` 분리 컨벤션 문서화
- [x] 환경 플래그(`EXPO_PUBLIC_USE_MOCK`)로 mock/real 토글
- [x] 공통 에러 핸들링·네트워크 retry 래퍼 제공
- [x] 샘플 feature에 패턴 적용 예시 1건

## [#4] 다국어(i18n) 기반 구축

**라벨**: feature/infra
**의존성**: #1
**범위**: en/zh-CN/zh-TW/ja/ko 5개 로케일 i18n 프레임워크 + 기기 locale 자동 감지 + 언어 전환 스토어

**완료 조건**

- [x] i18n 라이브러리 설정 및 5개 로케일 리소스 구조
- [x] 기기 locale 자동 감지 + 수동 변경(MMKV persist)
- [x] 모든 사용자 노출 문자열 i18n 키 사용 규칙 lint/문서화
- [x] zh/ja 장문 레이아웃 깨짐 점검 체크리스트
- [x] ja 번역 품질 우선 검수 플로우 정의

## [#5] 공통 UI 디자인 시스템 & 깐부 마스코트 에셋

**라벨**: feature/ui
**의존성**: #1
**범위**: Modern·Friendly·Clean 톤 공통 컴포넌트(버튼/카드/시트/empty state) + 깐부 마스코트 에셋 적용

**완료 조건**

- [x] Button·Card·BottomSheet·Loading·EmptyState 공통 컴포넌트
- [x] 큰 터치 영역·야외 시인성·한 손 조작 가이드 반영
- [x] 깐부 마스코트 에셋(아이콘/아바타/empty/로딩) 연결
- [x] 다크모드 variant 검증
- [x] `cn()` 클래스 병합 유틸 적용

## [#6] 탭 레이아웃 + 플로팅 AI 깐부 + SOS 상시 접근

**라벨**: feature/ui
**의존성**: #5
**범위**: Expo Router 4탭(Home/Map/Translate/My) 셸 + 플로팅 AI 깐부 버튼 + 상시 SOS 진입점 (콘텐츠는 후속 Issue)

**완료 조건**

- [x] `(tabs)` 4탭 내비게이션 구성
- [x] 플로팅 AI 깐부 버튼 전역 배치 + 라우팅
- [x] SOS 버튼 상시 접근 진입점
- [x] 탭 아이콘(언어 의존 최소) 적용
- [x] 미인증/Guest 상태에서도 탭 셸 진입 가능

## [#7] Guest(anonymous) 모드

**라벨**: feature/auth
**의존성**: #2, #6
**범위**: 가입 없이 핵심 기능 사용 가능한 Supabase anonymous 세션 + Guest 상태 관리

**완료 조건**

- [x] Supabase anonymous 로그인으로 첫 진입 세션 생성
- [x] `features/auth/store.ts` Guest 상태 관리(Zustand)
- [x] Guest 세션 MMKV persist 및 앱 재시작 유지
- [x] 핵심 기능(번역/지도/홈)에 가입 없이 접근 가능
- [x] Guest→로그인 전환 시 세션 연결(linkIdentity) 처리

## [#8] 소셜 로그인 (Google / Apple)

**라벨**: feature/auth
**의존성**: #7
**범위**: Supabase Auth Google·Apple 로그인 + 로그인 유도 시점(쿠폰 저장/AI 저장) 연결

**완료 조건**

- [x] Google 로그인 플로우(iOS/Android)
- [x] Sign in with Apple(스토어 심사 필수) 플로우
- [x] 쿠폰 저장·AI 대화 저장 시점 로그인 유도 모달
- [x] 로그인 성공 시 Guest 세션 데이터 승계
- [x] 로그인 실패·취소 시 friendly 안내 + 재시도

## [#9] 전화번호 OTP 로그인 (Phone)

**라벨**: feature/auth
**의존성**: #8
**범위**: Supabase Auth Phone OTP(NHN Cloud SMS custom provider) 로그인

**완료 조건**

- [x] 전화번호 입력 + 국가코드 선택 UI
- [x] NHN Cloud SMS custom provider OTP 발송 연동
- [x] OTP 입력·검증·재발송(타이머) 플로우
- [x] 인증 가드(`useAuth`) 미인증 시 보호 라우트 처리
- [x] 에러(만료/실패/한도) 핸들링

## [#10] 온보딩 — 언어 선택

**라벨**: feature/ui
**의존성**: #4, #6
**범위**: 첫 실행 시 기기 locale 자동 감지 + 언어 수동 선택 온보딩 1단계

**완료 조건**

- [x] 기기 locale 자동 감지 후 추천 언어 프리셋
- [x] 5개 언어 수동 선택 UI
- [x] 선택 언어 MMKV 저장 및 즉시 앱 반영
- [x] 온보딩 완료 여부 persist (재진입 시 skip)

## [#11] 온보딩 — 지역 & 관심사 선택

**라벨**: feature/ui
**의존성**: #10
**범위**: 여행 지역(Busan 등) + 관심사(Food/K-Culture/Shopping/Nature/Cruise) 선택, AI·추천 컨텍스트로 저장

**완료 조건**

- [x] 지역 선택(1차 Busan 중심) UI
- [x] 관심사 다중 선택 UI(아이콘 중심)
- [x] 선택값 users 프로필/로컬에 저장
- [x] 가입 없이 진행 가능(Guest)
- [x] 온보딩 완료 후 홈 진입

## [#12] 홈 화면 — 3대 버튼 + 주변 추천 + 위젯

**라벨**: feature/ui
**의존성**: #11
**범위**: Home 탭 — Translate Now / Ask AI Gganbu / Find Places 3대 버튼 + 주변 추천 카드 + 날씨/환율 위젯(mock)

**완료 조건**

- [x] 핵심 버튼 3개 배치 및 각 기능 라우팅
- [x] 주변 추천 POI 카드 리스트(mock 데이터)
- [x] 날씨/환율 위젯(mock → 후속 실 API 여지)
- [x] 위치 권한 거부 시 지역 수동 선택 degrade
- [x] 첫 진입 10초 내 핵심 기능 이해 가능한 레이아웃

## [#13] 텍스트 번역 — mock 구현

**라벨**: feature/translate
**의존성**: #12, #3
**범위**: Translate 탭 텍스트 입력↔번역 출력 UI + 번역 service mock

**완료 조건**

- [x] 원문/대상 언어 선택 + 스왑 UI
- [x] 텍스트 입력 → mock 번역 결과 표시
- [x] `translate/services` 인터페이스 정의(real 교체 가능)
- [x] 결과 복사·읽어주기 액션 자리
- [x] 빈 입력·네트워크 실패 friendly 처리

## [#14] 텍스트 번역 — 실 API 연동 (Papago)

**라벨**: feature/translate
**의존성**: #13
**범위**: mock을 Papago(우선)/Google Translation 실 API로 교체, 키 보호 위해 Edge Function 경유

**완료 조건**

- [x] Edge Function 경유 Papago 번역 호출
- [x] Papago 실패 시 Google Translation 폴백
- [x] 5개 언어 ↔ ko 번역 정상 동작
- [x] 응답 캐싱·retry 적용
- [x] API 키 클라이언트 미노출 검증

## [#15] 상황별 회화 + "보여주기" 모드

**라벨**: feature/translate
**의존성**: #13
**범위**: 식당/택시/호텔/쇼핑/병원 상황별 회화집 + 상대방에게 보여주는 큰 글씨 모드 (오프라인 번들)

**완료 조건**

- [x] 5개 상황 카테고리 회화 데이터(번들 jsonb, 오프라인 동작)
- [x] 회화 항목 선택 → 한국어 큰 글씨 보여주기 카드
- [x] 5개 언어 회화 표시
- [x] 즐겨 쓰는 문장 로컬 저장
- [x] 오프라인(네트워크 없음)에서 동작 검증

## [#16] 음성 통역 기본형 (Gemini Live + LiveKit)

**라벨**: feature/translate
**의존성**: #14, #15
**범위**: Gemini 3.5 Live Translate 음성↔음성 통역, LiveKit 미디어 스트리밍, 토큰 Edge Function 발급. preview 한계 대비 텍스트/회화 폴백

**완료 조건**

- [x] 마이크 권한 just-in-time 요청 + 거부 시 degrade
- [x] Edge Function 발급 토큰(LiveKit + Gemini 세션)으로 연결
- [x] Papago식 분할 화면 양방향(ko↔ja/zh/en) 통역
- [x] preview 오류/끊김 시 텍스트 번역·회화 폴백 전환
- [x] 약한 네트워크·재연결 처리

## [#17] K-Map — Google Maps 렌더링 셸

**라벨**: feature/map
**의존성**: #12
**범위**: Map 탭 Google Maps SDK 렌더링 + 현재 위치 + 기본 카메라 조작

**완료 조건**

- [x] Google Maps SDK 지도 렌더링(iOS/Android)
- [x] 위치 권한 just-in-time + 현재 위치 표시
- [x] 위치 거부 시 기본 지역(Busan) 중심 degrade
- [x] 지도 위 Marker/Polyline 오버레이 기반 구조
- [x] 지도 로딩·에러 상태 처리

## [#18] K-Map — POI 검색 (mock)

**라벨**: feature/map
**의존성**: #17, #3
**범위**: 목적지 검색 UI + 검색 결과 마커/카드 + map service mock

**완료 조건**

- [x] 검색 입력 → mock POI 결과 마커 표시
- [x] 결과 카드(이름/카테고리/주소) 바텀시트
- [x] `map/services` 인터페이스 정의(real 교체 가능)
- [x] 카드 → 길찾기/즐겨찾기 액션 연결 자리
- [x] 검색 결과 없음·실패 처리

## [#19] K-Map — 길찾기 + Naver Edge Function 연동

**라벨**: feature/map
**의존성**: #18
**범위**: mock을 Naver Cloud(Search/Directions/Geocoding) 실 데이터로 교체, Edge Function 경유 + 좌표 변환·캐싱

**완료 조건**

- [x] Edge Function 경유 Naver 검색·경로 호출(키 보호)
- [x] TM128↔WGS84 좌표 변환 처리
- [x] 경로를 Google Map 위 Polyline 오버레이
- [x] Google/Naver 결과 비교 모드 전환
- [x] 마지막 조회 지역 POI 24h 캐시

## [#20] K-Map — 즐겨찾기 (favorites)

**라벨**: feature/map
**의존성**: #19
**범위**: POI 즐겨찾기 저장/조회/삭제 + 오프라인 보관

**완료 조건**

- [x] favorites 테이블 저장/조회/삭제(RLS)
- [x] 즐겨찾기 목록 화면 + 지도 표시
- [x] 즐겨찾기 오프라인 보관(로컬 캐시)
- [x] Guest 상태 즐겨찾기 처리 + 로그인 승계
- [x] 즐겨찾기 → 길찾기 연결

## [#21] AI 깐부 — 채팅 UI (mock)

**라벨**: feature/gganbu
**의존성**: #12, #3
**범위**: 플로팅 버튼 → AI 깐부 채팅 화면 + 마스코트 아바타 + gganbu service mock

**완료 조건**

- [x] 플로팅 버튼 → 채팅 모달/스택 진입
- [x] 마스코트 아바타·말풍선 채팅 UI
- [x] mock 응답 스트리밍 표시
- [x] `gganbu/services` 인터페이스 정의(real 교체 가능)
- [x] 추천 장소 카드(지도/쿠폰 연결 자리) 렌더

## [#22] AI 깐부 — Claude API + RAG 1차

**라벨**: feature/gganbu
**의존성**: #21, #19
**범위**: Claude API 챗봇 실연동 + 위치/시간/언어 컨텍스트 주입 + TourAPI·큐레이션 RAG 1차 + 가드레일

**완료 조건**

- [x] Edge Function 경유 Claude API 호출(키 보호)
- [x] 위치·시간·언어·관심사 컨텍스트 주입
- [x] RAG 1차(TourAPI + 부산 큐레이션) 기반 추천
- [x] 추천 카드 → 지도/쿠폰 연결 동작
- [x] 의료·법률·비자 단정 금지 → 1330/SOS 가드레일

## [#23] 쿠폰함 — 저장 & 목록 (Travel Wallet)

**라벨**: feature/coupon
**의존성**: #12, #8
**범위**: My 탭 외국인 전용 쿠폰함 — 쿠폰 발견/저장/목록 (mock 쿠폰 데이터, 저장 시 로그인 유도)

**완료 조건**

- [x] 쿠폰 목록·상세 화면(다국어 title/조건)
- [x] 쿠폰 저장 시 로그인 유도(Guest→Auth)
- [x] `coupon_issues` 발급 저장(RLS)
- [x] 저장 쿠폰 My 탭 지갑 표시
- [x] 만료·사용완료 상태 구분 표시

## [#24] 쿠폰 QR — one-time 발급 & 오프라인 표시

**라벨**: feature/coupon
**의존성**: #23
**범위**: Edge Function one-time QR(TTL 5분) 발급 + 오프라인 QR 표시 + 사용 처리

**완료 조건**

- [x] Edge Function(service role) one-time QR 토큰 발급(TTL 5분)
- [x] QR 오프라인 표시(네트워크 없이 렌더)
- [x] 기기당 발급 제한 + 사용 로그(시간/위치)
- [x] 사용 처리 시 토큰 즉시 소멸
- [x] 만료/소멸 QR 재발급 플로우

## [#25] 긴급 도움 (SOS)

**라벨**: feature/emergency
**의존성**: #6, #4
**범위**: 경찰(112)/119/1330/대사관 연락 + "Help Me" 긴급 문장 + 현재 위치 공유 + 가까운 병원 찾기

**완료 조건**

- [x] SOS 화면 — 112/119/1330/대사관 원터치 연락
- [x] 상황별 긴급 문장 생성(오프라인 번들, 5개 언어)
- [x] 현재 위치 공유(좌표/주소 복사·공유)
- [x] 가까운 병원 찾기(지도 연결)
- [x] 네트워크/위치 거부 시에도 연락처·문장 표시

## [#26] 여권 OCR & 쇼핑 면세 혜택

**라벨**: feature/passport
**상태**: ✅ Phase 1 구현·실기기 검증 완료(서버 저장 채택) · ✅ Phase 2 환급 추적·영수증 스캐너 완료 · 🔜 Phase 3 잔여
**의존성**: My 탭 디자인(완료), #4(i18n), 카메라 권한, Google Vision(설정됨)
**범위**: My 메뉴에서 여권 촬영 → MRZ OCR(Google Vision) → 여권 정보 파싱·저장 → 외국인 쇼핑 면세(Tax Refund) 혜택 제공
**상세 계획**: `docs/tasks/passport-ocr.md`

**Phase 1 — 완료** (서버 저장, RLS는 current_user_id 패턴으로 정렬)

- [x] DB 스키마: `passport_scans` + `passport_data` + RLS(본인 read/delete, 쓰기 service role) — 마이그레이션 20260625004
- [x] Storage `passport-images`(Private) 버킷 + 본인 폴더 RLS — 20260625005
- [x] Edge Function `passport-ocr`(ACTIVE): Storage 업로드 → Vision TEXT_DETECTION → MRZ(TD3) 인라인 파싱(체크 디지트) → DB 저장
- [x] `features/passport/queries`(usePassport/useScanPassport/useRemovePassport) + `app/passport.tsx`(미등록 CTA/등록 카드/삭제)
- [x] 촬영/갤러리 + just-in-time 권한, MRZ 실패 재촬영 안내, My 카드 등록 상태 연동, passport.\* i18n 5종
- [x] 실기기 검증: 스캔→OCR→DB 기록 + 실 여권 등록 표시 확인

**Phase 2 — 완료** (커밋 `fecf3db`, 디자인 등록 카드 퀵액션)

- [x] VAT 환급 추적(refund tracker) — 영수증 누적·환급 예상액 (`tax_free_receipts` + `features/taxfree` 순수로직·단위테스트 6건 + `app/tax-free.tsx` 요약)
- [x] 영수증 스캐너(receipt scanner) — 구매 영수증 OCR·적립 (Edge Function `receipt-ocr`: Vision OCR → 합계/날짜/상호 휴리스틱 추출·저장, ACTIVE)
- [~] 공항 환급 QR(airport QR) — 여권번호 기반 정적 QR 표시까지 구현 / 김해공항 실 환급 청구 연계는 Phase 3

**Phase 3 — 잔여** (외부 파트너·인프라 의존)

- [ ] 제휴 매장 즉시면세 연동 / Web Admin(별도 앱) 스캔 목록·재처리
- [ ] 개인정보: 여권·영수증 이미지 보관 정책 정밀화(보관기간·자동삭제·암호화 강화) — PIPA 검토
