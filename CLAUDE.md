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
```

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
