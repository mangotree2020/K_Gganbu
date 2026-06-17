# 외부 설정 가이드 (🔶 항목)

> `docs/BACKLOG.md` 진행 현황표의 🔶 항목 — **코드는 완료**됐고, 실제 동작에 외부 키·대시보드 설정이 필요한 6개 항목(#8·#9·#14·#16·#19·#22)의 셋업 절차.
> 작성: 2026-06-17. 변수/시크릿 이름은 코드 기준(임의 변경 금지).

## 원칙

- **클라이언트 노출 변수**: `EXPO_PUBLIC_` 접두사 → 앱 `.env`. 지도 렌더링용 공개 ID만 해당.
- **서버 전용 비밀키**: `EXPO_PUBLIC_` 금지 → `supabase secrets set KEY=...` (Edge Function 런타임에서만 접근).
- 설정 후 각 항목의 **검증** 절차로 확인. `EXPO_PUBLIC_USE_MOCK=true`면 외부 API를 건너뛰고 mock으로 동작하므로, 실 연동 검증 시 `false` 또는 미설정.

## 시크릿 한눈에 보기

| 항목 | 종류        | 이름                                                                               | 발급처                    | 비고                           |
| ---- | ----------- | ---------------------------------------------------------------------------------- | ------------------------- | ------------------------------ |
| #8   | 대시보드    | Google·Apple OAuth provider                                                        | Supabase Auth             | + Anonymous linking 허용       |
| #9   | 대시보드    | Phone provider + 커스텀 SMS                                                        | Supabase Auth + NHN Cloud | NHN Cloud SMS API              |
| #14  | 시크릿      | `GOOGLE_TRANSLATION_API_KEY`                                                       | Google Cloud              | translate 함수                 |
| #16  | 시크릿+워커 | `LIVEKIT_API_KEY` `LIVEKIT_API_SECRET` `LIVEKIT_URL`                               | LiveKit Cloud             | + Gemini Live Agent 워커(별도) |
| #19  | 시크릿+공개 | `NAVER_SEARCH_CLIENT_*` `NAVER_MAPS_CLIENT_*` / `EXPO_PUBLIC_NAVER_MAPS_CLIENT_ID` | Naver Developers + NCP    | 검색/경로 키 별개              |
| #22  | 시크릿      | `ANTHROPIC_API_KEY` `TOUR_API_KEY`                                                 | Anthropic + 한국관광공사  | gganbu 함수                    |

> 공통 선행: Edge Function 배포 — `supabase functions deploy <name>` (대상: `translate` `gganbu` `places` `ocr` `coupon` `naver-search` `naver-directions` `livekit-token`).

---

## #8 소셜 로그인 (Google / Apple)

**필요**: Supabase 대시보드 Auth provider 설정 (코드: `src/features/auth/queries.ts` `useOAuthSignIn`).

1. **Google**: [Google Cloud Console](https://console.cloud.google.com) → OAuth 2.0 클라이언트 ID(웹) 생성 → Supabase **Authentication → Providers → Google**에 Client ID/Secret 입력.
2. **Apple**: [Apple Developer](https://developer.apple.com) → Service ID + Sign in with Apple Key 생성 → Supabase **Providers → Apple**에 입력. (App Store 심사 필수 — PLANNING §23)
3. **Redirect URL**: Supabase가 제공하는 콜백 URL을 각 provider에 등록. 앱 콜백은 `auth-callback` (expo-linking `createURL`).
4. **Guest 승계(중요)**: **Authentication → Providers**에서 _Allow manual linking_ (또는 Anonymous→permanent linking) 활성화. 미활성 시 `linkIdentity`가 실패하여 Guest 데이터(즐겨찾기·쿠폰) 승계 불가 (#7 연동).

**검증**: Guest로 진입 → 쿠폰 저장 시 로그인 시트 → Google/Apple 로그인 → 로그인 후에도 동일 `user_id` 유지(저장 쿠폰 그대로) 확인.

## #9 전화번호 OTP 로그인

**필요**: Supabase Phone Auth + NHN Cloud SMS 커스텀 provider (코드: `useSendOtp`/`useVerifyOtp`, 화면 `app/(auth)/phone.tsx`).

1. **Authentication → Providers → Phone** 활성화.
2. **SMS provider = Custom** 선택 후 NHN Cloud SMS 발송 웹훅/연동 구성 (NHN Cloud Console에서 SMS 상품 신청 → 발신번호 사전등록 → App Key/Secret 발급).
3. 발신번호(한국)·국제 발송 허용 여부 확인. 앱은 E.164(`+국가코드`)로 전송하며 11개국 국가코드 선택 UI 제공.
4. **Rate limit**: Supabase Auth의 SMS 전송 한도·재시도 정책 확인 (앱은 60초 재발송 쿨다운 적용).

**검증**: 실제 번호로 코드 발송 → 6자리 입력 → 인증 성공. 만료/오입력/한도 시 친화 메시지 노출 확인.

## #14 텍스트 번역 (Google Cloud Translation)

**필요**: `GOOGLE_TRANSLATION_API_KEY` (코드: `supabase/functions/translate`). PLANNING §11에서 **Google Cloud Translation 단독**으로 확정(Papago 폐기).

1. [Google Cloud Console](https://console.cloud.google.com) → **Cloud Translation API** 사용 설정 → API 키 발급.
2. ```bash
   supabase secrets set GOOGLE_TRANSLATION_API_KEY=...
   supabase functions deploy translate
   ```

**검증**: 번역 탭에서 텍스트 입력 → 5개 언어 ↔ ko 정상 번역. 실패 시 mock 폴백 배지 표시되면 키 미설정/오류 신호.

## #16 음성 통역 (Gemini Live + LiveKit)

**필요**: LiveKit 시크릿 3종 + **Gemini Live Agent 워커(이 저장소 밖, 별도 배포)** (코드: `supabase/functions/livekit-token`, 화면 `app/voice-interpret.tsx`).

1. **LiveKit Cloud**: 프로젝트 생성 → API Key/Secret/URL 확보.
   ```bash
   supabase secrets set LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... LIVEKIT_URL=wss://<project>.livekit.cloud
   supabase functions deploy livekit-token
   ```
   `livekit-token` 함수는 LiveKit access token 발급 + 통역 방향(`targetLang`)을 룸 메타데이터로 전달.
2. **Gemini Live Agent 워커**: LiveKit 룸에 참가해 Gemini Live API(`gemini-3.5-live-translate-preview`)로 speech↔speech 통역하는 Agent 프로세스를 별도 배포(LiveKit Agents 프레임워크). 이 워커가 **Gemini API 키**를 보유(앱·Edge Function 미노출).
3. preview 단계 — 가용성/쿼터 변동 가능. 미설정/오류 시 앱은 자동으로 _"음성통역 준비 필요"_ 안내 + 텍스트 번역 폴백으로 degrade (코드 완료).

**검증**: 키·워커 설정 후 음성통역 진입 → 마이크 권한 허용 → 양방향 통역 transcript 표시. 끊김 시 재연결/폴백 동작 확인.

## #19 K-Map 길찾기 (Naver)

**필요**: 검색·경로 시크릿(별개) + 지도 렌더링용 공개 ID (코드: `naver-search`·`naver-directions`, 렌더 `src/features/map/NaverMap.tsx`).

> 메모: Naver는 **검색(Developers)과 경로/지도(NCP) 키가 별개**다. 코드는 전용 키 우선, 없으면 `NAVER_CLIENT_*`로 폴백.

1. **검색** — [Naver Developers](https://developers.naver.com) 지역검색 API 키:
   ```bash
   supabase secrets set NAVER_SEARCH_CLIENT_ID=... NAVER_SEARCH_CLIENT_SECRET=...
   ```
2. **경로/지오코딩** — [NCP(Naver Cloud Platform)](https://www.ncloud.com) Maps Directions:
   ```bash
   supabase secrets set NAVER_MAPS_CLIENT_ID=... NAVER_MAPS_CLIENT_SECRET=...
   supabase functions deploy naver-search naver-directions
   ```
3. **지도 렌더링(공개 ID)** — 앱 `.env`:
   ```
   EXPO_PUBLIC_NAVER_MAPS_CLIENT_ID=<NCP Maps Client ID>
   ```
   NCP 콘솔의 해당 앱 **Web 서비스 URL**에 `https://localhost` 등록 필수(WebView 인증). 좌표는 TM128↔WGS84 변환을 Edge Function이 처리.

**검증**: 지도 탭 검색 → POI 마커 → 길찾기 → Google Map 위 Polyline 오버레이. 마지막 조회 지역 24h 캐시.

## #22 AI 깐부 (Claude + RAG)

**필요**: `ANTHROPIC_API_KEY` + `TOUR_API_KEY` (코드: `supabase/functions/gganbu`). 모델 `claude-opus-4-8`.

1. **Anthropic**: [console.anthropic.com](https://console.anthropic.com) API 키 발급.
2. **TourAPI**: 한국관광공사 TourAPI 4.0 키 발급(무료) — RAG 1차 소스.
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=... TOUR_API_KEY=...
   supabase functions deploy gganbu places
   ```

**검증**: AI 깐부 채팅에서 위치/관심사 기반 추천 응답 + 추천 카드 → 지도/쿠폰 연결. 의료·법률·비자 질문 시 1330/SOS 안내 가드레일 확인. 키 미설정 시 mock 폴백.

---

## 배포 후 점검 체크리스트

- [ ] `supabase functions deploy` 8종 완료
- [ ] `supabase secrets list`로 시크릿 등록 확인
- [ ] `.env`에 `EXPO_PUBLIC_*` 공개 키 입력, `EXPO_PUBLIC_USE_MOCK` 비움
- [ ] 소셜/전화 로그인 + Guest 승계 동작
- [ ] 번역·AI·지도 실 API 응답(폴백 배지 미표시) 확인
- [ ] 음성통역 키·Agent 워커 미설정 시에도 친화 폴백 동작
- [ ] `get_advisors`로 Supabase 보안/성능 권고 점검
