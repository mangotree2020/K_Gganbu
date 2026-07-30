# Travel App — React Native 여행 앱 k-gganbu

## 프로젝트 기획

이 프로젝트의 전체 기획·아키텍처·결정사항은 @docs/PLANNING.md 를 따른다.
작업 전 반드시 해당 문서를 우선 참조할 것.

사업전략·BM 검증은 `docs/BUSINESS_STRATEGY.md`(기능×BM×개발 매칭표 §6이 싱크 기준),
제품 요구사항(PO)은 `docs/PRODUCT_REQUIREMENTS.md`를 따른다.
신규 기능은 BM 문서 §6 등재 → PRD REQ 추가 → BACKLOG 분해 순서를 지킬 것.

## 프로젝트 개요

Expo SDK 56 기반 React Native 여행 앱. Supabase 인증, Zustand 상태관리, TanStack Query 서버 상태, NativeWind v4 스타일링을 사용합니다.

## 실행 명령어

```bash
# 개발 서버 (Expo Go 전용 — MMKV 미작동)
npm start

# iOS/Android (development build — MMKV 포함)
npm run prebuild   # 네이티브 폴더 생성 (최초 1회)
npm run ios        # iOS 시뮬레이터
npm run android    # Android 에뮬레이터

# 코드 검사
npm run lint       # ESLint
npm run type-check # TypeScript
npm test           # Jest
```

## 검증 루틴 (필수)

완료 정의(DoD)·검증 순서·타입/린트 기준·회귀 점검·최소 변경·AI 리뷰 가능성·환각 구현 금지·
완료 보고 형식은 전역 `~/.claude/CLAUDE.md`의 "품질 보증·검증 정책"을 따른다.
아래는 **이 프로젝트의 실제 명령어와 예외**만 적는다.

```bash
npm run type-check   # 1. 타입
npm run lint         # 2. 린트
npm test             # 3. 단위 테스트
npx expo export --platform android           # 4. 번들 검증 (조건부, 아래 참조)
codex exec --sandbox read-only "<검증 요청>"   # 5. Codex 교차 검증
                     # 6. 수동 확인 체크리스트
```

**4. 번들·네이티브 빌드 검증(조건부)** — 이 저장소에는 `npm run build`가 없고 `tsc`는
빌드 검증이 아니다. Metro 번들 단계에서만 드러나는 결함(모듈 해석 실패, 누락 에셋,
플랫폼 전용 import, 신규 expo-router 라우트 등록)이 있으므로 아래 경우에는 반드시 실행한다.

- 네이티브 의존성 추가·변경, `app.json`/config plugin 변경 → `npm run prebuild` 후 실기기 설치
- 신규 라우트·에셋·동적 import 추가, 릴리스(TestFlight/내부트랙) 직전 → `npx expo export`
- 그 외 순수 로직·UI 수정은 생략 가능. 생략했으면 보고서에 `SKIPPED(사유)`로 남긴다

**5. Codex 교차 검증** — 실행 규칙은 전역 정책 참조. 실제로 이 단계에서만 잡힌 결함이 있었다
(네팔어 `बदाम`=아몬드를 땅콩 알레르기 문구에 사용, 카자흐어 경찰 호출 문구의 대격 누락 등 —
`docs/I18N_SEA_REVIEW.md`). 반영·유보 내역은 해당 검수 문서에 남긴다.

**6. 수동 확인** — 전역 체크리스트에 더해 이 앱 특성: 위치·마이크·카메라 권한 거부 시 degrade,
오프라인 QR·긴급 문장, 로밍·저속 네트워크, 언어별(zh·ja 장문) 레이아웃 깨짐,
실기기(iPhone + 중저가 Android) 동일 동작.

### 테스트 범위 (이 저장소)

- **단위(Jest + ts-jest)**: 쿠폰 검증, i18n 포맷, 언어 매핑, 결제 라우팅 규칙 등 순수 로직
- **모듈 간 흐름**: RNTL(react-native-testing-library)이 없어 컴포넌트 렌더 테스트가 불가하다.
  화면-서비스-API-상태 연동은 Maestro E2E(`.maestro/`, `npm run test:e2e`) + 실기기 확인으로
  검증한다. 필요하면 Maestro 플로우를 추가한다
- 목킹은 외부 API(TourAPI·Naver·Google·Gemini·Supabase)·네이티브 모듈 경계까지만

### 이 프로젝트의 회귀 점검 영향권

공용 유틸(`src/utils`, `src/lib`), 공용 컴포넌트(`src/components`), Zustand store,
라우팅(`app/_layout.tsx` Stack 등록), 인증 가드(`useAuth`), Edge Function 계약, i18n 키.
외부 API 응답은 Zod로 검증(TourAPI·Naver·Gemini), 매직 값은 `@/theme/tokens` 재사용,
Expo 코드는 SDK 56 문서(docs.expo.dev) 확인, 개선점은 `docs/BACKLOG.md`로 분리.

번역·i18n 작업은 여기에 더해 `docs/I18N_SEA_REVIEW.md`(동남아·유럽 등 확장 언어)와
`docs/I18N_JA_REVIEW.md`(일본어)의 검수 시트를 갱신한다. **LLM 교차 검증은 원어민 검수를
대체하지 않는다** — 두 문서 모두 원어민 검수 상태를 별도로 추적한다.

## 환경변수 설정

`.env.example`을 복사하여 `.env`를 만들고 Supabase 프로젝트 값을 입력하세요:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 코드 컨벤션

- 들여쓰기: 스페이스 2칸
- 세미콜론: 없음
- 따옴표: 작은따옴표
- 네이밍: camelCase (변수/함수), PascalCase (컴포넌트/타입)

## 아키텍처 규칙

### 상태관리 분리

| 상태 유형            | 도구                    | 위치                                                  |
| -------------------- | ----------------------- | ----------------------------------------------------- |
| 서버 데이터 (API)    | TanStack Query          | `src/features/{domain}/queries.ts`                    |
| UI 상태 (필터, 선택) | Zustand                 | `src/features/{domain}/store.ts`                      |
| 인증 상태            | Zustand + Supabase 구독 | `src/features/auth/store.ts` + `src/hooks/useAuth.ts` |

### 파일 구조 패턴

```
src/features/{domain}/
  types.ts    — TypeScript 타입 + Zod 스키마
  store.ts    — Zustand 클라이언트 상태 (필요시)
  queries.ts  — TanStack Query 훅 (Supabase/API 호출)
  components/ — 도메인 전용 컴포넌트 (필요시)
```

### Path Aliases

```ts
@/ui/*         → src/components/ui/*      (react-native-reusables 컴포넌트)
@/components/* → src/components/*
@/features/*   → src/features/*
@/lib/*        → src/lib/*
@/hooks/*      → src/hooks/*
@/utils/*      → src/utils/*
@/theme/*      → src/theme/*              (디자인 토큰)
```

### 디자인 시스템 (docs/K-Gganbu (standalone).html 기준)

화면 구현 시 색상/그라데이션을 직접 하드코딩하지 말고 아래를 재사용한다.

- `@/theme/tokens` — `palette`(bm 팔레트: blue/coral/teal/zinc/amber/cruise/error/success), `gradients`, `shadows`(card/pop/fab/blue), `radius`, `pillTones`
- `@/components/brand` — `AppIcon`(스마일 맵핀), `BrandMark`(워드마크), `Icon`(디자인의 Material Symbols 이름 → lucide 매핑), `Pill`(톤별 배지)
- `@/components/PlaceThumb` — 카테고리별 그라데이션 썸네일
- `@/components/SheetHeader` — 모달 시트 공용 헤더
- 그라데이션은 `expo-linear-gradient`의 `LinearGradient` 사용
- 컬러 의미: Sky Blue=네비/검색, Coral=쿠폰/FAB/알림, Teal=번역 전용

**라우팅**: 4탭 `app/(tabs)/{index,map,ai,coupons,profile}` + 모달 라우트
`app/{translate,emergency,place,cruise,tips,allergy}.tsx` (`presentation: 'modal'`).
모달은 루트 `app/_layout.tsx`의 Stack에 등록.

> 주의: `<Pressable>`에 함수형 style(`({pressed}) => [...]`)이 간헐적으로 적용 안 되는
> 사례가 있었음. 카드형 Pressable은 plain 배열 style(`[ss.card, shadows.card]`) 권장.

### Supabase 쿼리 패턴

```ts
// queries.ts — 항상 TanStack Query 훅 안에서만 supabase 직접 호출
export function useTrips() {
  return useQuery({
    queryKey: ['trips', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('trips').select('*')
      if (error) throw error
      return data
    },
  })
}
```

### 폼 처리 패턴

```ts
// types.ts — Zod 스키마 정의
export const loginSchema = z.object({ ... })
export type LoginFormData = z.infer<typeof loginSchema>

// 화면 컴포넌트 — RHF + zodResolver
const { control, handleSubmit } = useForm<LoginFormData>({
  resolver: zodResolver(loginSchema),
})
```

## Supabase 테이블 구조

```sql
-- profiles (auth.users와 1:1)
profiles: id, full_name, avatar_url, created_at

-- trips (여행 일정)
trips: id, user_id, title, destination, start_date, end_date, cover_image_url, description, created_at

-- destinations (공개 읽기)
destinations: id, name, country, description, cover_image_url, tags, rating, latitude, longitude
```

RLS 정책: trips/profiles는 `auth.uid() = user_id`, destinations은 공개 읽기.

## 주의사항

- `react-native-mmkv`는 native module → Expo Go에서 작동하지 않음. `npm run prebuild` 후 시뮬레이터 직접 설치 필요
- NativeWind 클래스는 `src/utils/cn.ts`의 `cn()` 함수로 병합
- `.env`는 절대 커밋하지 않음 (`.gitignore`에 포함됨)
- `src/components/ui/`는 react-native-reusables CLI로 추가한 컴포넌트 위치
