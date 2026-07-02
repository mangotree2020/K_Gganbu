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

> 공통 선행: Edge Function 배포 — `supabase functions deploy <name>` (대상: `translate` `translate-content` `gganbu` `places` `ocr` `coupon` `partner-coupon` `naver-search` `naver-directions` `livekit-token` `gemini-live-token`).
> `translate-content`(콘텐츠 자동 번역 파이프라인)는 `translate`와 동일하게 `GOOGLE_TRANSLATION_API_KEY` 사용 — 소스 텍스트를 5개 로케일 jsonb로 채움.

---

## #8 소셜 로그인 (Google / Apple)

**필요**: Supabase 대시보드 Auth provider 설정 (코드: `src/features/auth/queries.ts` `useOAuthSignIn`).

1. **Google**: [Google Cloud Console](https://console.cloud.google.com) → OAuth 2.0 클라이언트 ID(웹) 생성 → Supabase **Authentication → Providers → Google**에 Client ID/Secret 입력.
2. **Apple**: [Apple Developer](https://developer.apple.com) → Service ID + Sign in with Apple Key 생성 → Supabase **Providers → Apple**에 입력. (App Store 심사 필수 — PLANNING §23)
3. **Redirect URL**: Supabase가 제공하는 콜백 URL을 각 provider에 등록. 앱 콜백은 `auth-callback` (expo-linking `createURL`).
4. **Guest 승계(중요)**: **Authentication → Providers**에서 _Allow manual linking_ (또는 Anonymous→permanent linking) 활성화. 미활성 시 `linkIdentity`가 실패하여 Guest 데이터(즐겨찾기·쿠폰) 승계 불가 (#7 연동).

**검증**: Guest로 진입 → 쿠폰 저장 시 로그인 시트 → Google/Apple 로그인 → 로그인 후에도 동일 `user_id` 유지(저장 쿠폰 그대로) 확인.

## #9 전화번호 OTP 로그인 (Twilio Verify)

**필요**: Supabase Phone Auth + **Twilio Verify** (PLANNING 원안 NHN→Twilio 변경, 일본 우선 국제발송 적합). 코드: `useSendOtp`/`useVerifyOtp`, 화면 `app/(auth)/phone.tsx`.

1. **Authentication → Providers → Phone** 활성화 + **SMS provider = Twilio Verify**.
2. Twilio에서 **Verify Service** 생성 → Supabase에 **Account SID / Auth Token / Verify Service SID(`VA…`)** 입력. (일반 "Twilio"+`MG…`/번호도 가능하나 Verify가 OTP 전용·간편)
3. 앱은 E.164(`+국가코드`, 국내 0 제거)로 전송, 11개국 국가코드 선택 UI. Geo Permissions에서 대상국(예: Korea +82) 허용.
4. **Rate limit**: Supabase SMS 한도 확인(앱은 60초 재발송 쿨다운).

**테스트(실 SMS 없이)**: Supabase Phone 설정의 **Test Phone Numbers and OTPs**에 `+821090989425=789012` 형식 등록 → 그 번호로 signInWithOtp는 실 발송 없이 성공, verifyOtp는 등록 OTP로 통과. (Twilio trial은 verified 번호만 실발송 → 실 SMS는 **계정 업그레이드** 필요)

**검증(2026-07-01 완료)**: 테스트번호로 발송→verifyOtp(type:sms)→세션 JWT 발급 확인. 실 SMS 발송은 업그레이드 후.

### OTP 남용/비용 방지 (2026-07-01 결정 — Rate Limit 우선)

SMS 실비(~160원/건) 방어. **Auth → Rate Limits**로 총량 상한:

- **Rate limit for sending SMS messages**: **30 sms/h 설정(2026-07-01 적용)**. 최악 비용 상한 30×160≈4,800원/시간, 사용자 증가 시 상향.
- 관련 한도(기본 적정): 익명 sign-in 30/h·IP, sign-up/in 360/h·IP, OTP verify 360/h·IP.
- OTP 60초 재요청 간격(앱 `phone.tsx` 60초 쿨다운도 적용).

> **CAPTCHA는 보류(관측 후)**: Supabase CAPTCHA는 전역 토글이라 sign-up/sign-in/reset **+ 익명 sign-in**까지 강제 → 게스트 우선(첫 실행 `signInAnonymously`, §7/§14) UX와 충돌(첫 실행 CAPTCHA). 실제 봇 남용 관측 시 도입하되, 게스트 UX 보존을 위해 **OTP 전용 Edge Function 게이트웨이**(Turnstile 서버검증+레이트리밋 후 OTP) 방식 우선 검토. hCaptcha/Turnstile 공식 컴포넌트는 웹 전용이라 RN은 WebView 래퍼 필요.

### Auth 이메일 발송 (커스텀 SMTP) — 🔜 프로덕션 TODO (현재 비차단)

**현황**: Auth → Rate Limits의 **"Rate limit for sending emails = 2/h"** 는 Supabase **내장 이메일 서비스 기본 상한**(회색 잠금 = 커스텀 SMTP 없이는 변경 불가). 에러 아님.

**영향(제한적)**: Auth 이메일 발송 경로는 ① 이메일 가입 확인메일 ② 비밀번호 재설정뿐. 우리 앱은 게스트/소셜/전화 OTP 중심이고 이메일은 부차 옵션이라 현재 비차단. LINE 플로우는 메일 미발송(`admin.createUser` email_confirm + `generateLink` 토큰 반환).

**계획**: 내장 이메일은 dev/test 전용(저상한·낮은 전달률) → 프로덕션은 **커스텀 SMTP** 필수. **회사가 Google Workspace(유료 구글메일) 보유 → 자체 SMTP 가능:**

- **Gmail SMTP**: `smtp.gmail.com:587`(TLS), user=워크스페이스 계정, pass=**앱 비밀번호**(계정 2FA 필요). ~2,000통/일.
- **Workspace SMTP relay(프로덕션 권장)**: `smtp-relay.gmail.com:587`. Google Admin 콘솔 → Apps → Gmail → Routing → **SMTP relay service** 설정(허용 발신자/인증). ~10,000통/일, 도메인 발신(예: `noreply@mangonw.com`)으로 브랜딩·스팸함 회피.
- **Supabase 적용**: Auth → Emails → **SMTP Settings**에 host/port/user/pass/sender 입력 → 저장 후 이메일 Rate limit 상향(기본 30/h~, 조정 가능).

> 착수 조건: 이메일 가입 트래픽이 유의미해지거나 출시 준비 시. 그 전까지는 SMS Rate Limit·소셜/OTP로 충분.

## #14 텍스트 번역 (Google Cloud Translation)

**필요**: `GOOGLE_TRANSLATION_API_KEY` (코드: `supabase/functions/translate`). PLANNING §11에서 **Google Cloud Translation 단독**으로 확정(Papago 폐기).

1. [Google Cloud Console](https://console.cloud.google.com) → **Cloud Translation API** 사용 설정 → API 키 발급.
2. ```bash
   supabase secrets set GOOGLE_TRANSLATION_API_KEY=...
   supabase functions deploy translate
   ```

**검증**: 번역 탭에서 텍스트 입력 → 5개 언어 ↔ ko 정상 번역. 실패 시 mock 폴백 배지 표시되면 키 미설정/오류 신호.

## #16 음성 통역 (Gemini Live 직결 — B안, 대면 대화 통역)

> **아키텍처 변경(2026-06-18)**: 대면 대화 통역에는 LiveKit 룸·서버 Agent가 불필요.
> 기기가 **Gemini Live에 직접 연결**하고, 장기 키는 Edge Function의 **ephemeral 토큰**으로 보호한다.
> (LiveKit 경로는 다자/통화형 확장 시 재활용 — `livekit-token` 함수는 보존)

**필요**: `GEMINI_API_KEY`(Gemini Live preview 접근) + 네이티브 PCM 오디오 모듈.

1. **Gemini API 키** — [aistudio.google.com](https://aistudio.google.com) Live API(preview) 접근 키:
   ```bash
   supabase secrets set GEMINI_API_KEY=...
   supabase functions deploy gemini-live-token
   ```
   `gemini-live-token`이 v1alpha auth token(단기·1회)으로 ephemeral 토큰 발급 → 클라가 그 토큰으로 `wss://…BidiGenerateContent`에 직접 접속(장기 키 미노출).
2. **클라이언트**: `src/features/translate/geminiLive.ts` — 모델 `gemini-3.1-flash-live-preview` + systemInstruction으로 **양방향 자동 통역**(외국인↔한국어, 언어 자동 감지). 16kHz PCM 송신, 24kHz PCM + 원문/통역 transcription 수신. WS 응답은 ArrayBuffer 프레임이라 UTF-8 디코딩.
3. **네이티브 오디오**: 16kHz PCM 마이크 스트림 캡처 + 출력 모듈 필요(`prebuild` 1회). 미설정/오류 시 앱은 텍스트 번역 폴백 상시 노출(코드 완료).

**검증**: 키·오디오 모듈 설정 후 음성통역 진입 → 마이크 허용 → 화자 원문/번역 transcript 표시 + 번역 음성 출력. 미응답 시 "텍스트 번역으로" 탈출구로 전환.

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

## Admin 기본형 (파트너 쿠폰 등록) — 백엔드 primitive

> Admin UI는 **별도 앱/대시보드**(이 RN 소비자 앱 저장소 밖). 그 핵심 백엔드인 파트너 쿠폰
> 등록 API는 이 저장소의 `partner-coupon` Edge Function으로 제공한다.

1. 공유 시크릿 설정 후 배포:
   ```bash
   supabase secrets set ADMIN_API_KEY=...
   supabase functions deploy partner-coupon
   ```
2. Admin 앱은 `x-admin-key` 헤더로 호출 — `action: 'register'`(쿠폰 생성) / `'list'`(파트너 쿠폰 목록). 미설정 시 503으로 비활성.

**검증**: `register`로 활성 파트너 쿠폰 생성 → 앱 쿠폰 탭에 노출 확인. 비활성 파트너/키 불일치 시 거부.

## LINE 로그인 (커스텀 — Supabase 네이티브 미지원)

**필요**: LINE Developers Login 채널 + 시크릿. 코드: `src/features/auth/queries.ts` `useLINESignIn`, Edge Function `line-auth`(배포됨, verify_jwt=false).

> Supabase는 LINE provider가 없어 Google/Apple처럼 대시보드 토글로 끝나지 않는다.
> 앱이 LINE OAuth로 code 획득 → `line-auth`가 토큰교환·`id_token` 검증 → magiclink 토큰 발급 →
> 앱이 `verifyOtp(token_hash)`로 세션 확립(LINE sub→동일 계정 매핑, 이메일 없으면 `line_<sub>@users.kgganbu.app`).
>
> **커스텀 스킴 이슈**: LINE은 redirect_uri로 커스텀 스킴(`travel-app://`)을 불허(https만) →
> https 중계 함수 `line-callback`이 LINE 콜백을 받아 앱 스킴으로 302 바운스한다.

1. [LINE Developers](https://developers.line.biz) → Provider 생성 → **LINE Login 채널** 생성.
2. 채널 **Callback URL**에 **https 중계 함수 URL** 등록(커스텀 스킴 불가):
   ```
   https://ltdajglszqkgneegjryb.supabase.co/functions/v1/line-callback
   ```
3. **Channel ID**(공개) → 앱 `.env`의 `EXPO_PUBLIC_LINE_CHANNEL_ID`.
4. **Channel ID/Secret** → 서버 시크릿:
   ```bash
   supabase secrets set LINE_CHANNEL_ID=... LINE_CHANNEL_SECRET=...
   # line-auth는 이미 배포됨(미설정 시 no_line_config 반환)
   ```
5. scope는 `openid profile`(이메일 scope는 LINE 심사 필요 → 초기 생략).

**검증**: 로그인 화면 → "Continue with LINE"(`EXPO_PUBLIC_LINE_CHANNEL_ID` 있을 때만 활성) → LINE 인증 →
앱 복귀 → `auth.users`에 `app_metadata.provider=line` 유저 + 세션 생성 확인. 미설정 시 버튼은 "Coming soon"으로 graceful degrade.

## FCM 푸시 실 전송 (REQ-NT-1 — 코드 완료 2026-07-02)

**필요**: Firebase 콘솔 서비스 계정 키 + 실기기 재빌드. 코드: `src/features/notifications/services.ts`(실 어댑터, lazy require·mock 폴백), Edge Function `push-send`(배포됨), `device_tokens` 테이블(적용됨).

1. `@react-native-firebase/messaging` 설치됨(네이티브 모듈) → **`npm run prebuild` 후 실기기 재빌드 1회 필요**. 재빌드 전 구 빌드에서는 mock 경로로 degrade(크래시 없음).
2. Firebase 콘솔 → 프로젝트 설정 → **서비스 계정** → "새 비공개 키 생성"(JSON) → 서버 시크릿:
   ```bash
   supabase secrets set FCM_SERVICE_ACCOUNT='<JSON 파일 내용 전체>'
   ```
3. 발송 게이트: `push-send`는 `x-admin-key`(ADMIN_API_KEY, partner-coupon과 공유) 필수 — 클라이언트 직접 호출 불가.

**검증**: 프로필 알림 opt-in → `device_tokens`에 실 토큰 행 생성 확인 →
`curl -X POST .../push-send -H "x-admin-key: $ADMIN_API_KEY" -d '{"user_id":"<uuid>","title":"Test","body":"Hello"}'` → 기기 알림 도착.

## 배포 후 점검 체크리스트

- [ ] `supabase functions deploy` 11종 완료
- [ ] `supabase secrets list`로 시크릿 등록 확인
- [ ] `.env`에 `EXPO_PUBLIC_*` 공개 키 입력, `EXPO_PUBLIC_USE_MOCK` 비움
- [ ] 소셜/전화 로그인 + Guest 승계 동작
- [ ] 번역·AI·지도 실 API 응답(폴백 배지 미표시) 확인
- [ ] 음성통역 키·Agent 워커 미설정 시에도 친화 폴백 동작
- [ ] `get_advisors`로 Supabase 보안/성능 권고 점검
- [ ] **Auth 커스텀 SMTP**(Google Workspace SMTP relay) 설정 + 이메일 Rate limit 상향 — 이메일 가입/재설정 메일 전달률·상한 확보(§#9 하위 "Auth 이메일 발송")
