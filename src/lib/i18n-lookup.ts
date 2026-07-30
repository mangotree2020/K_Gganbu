// i18n 문자열 조회 순수 로직 (BACKLOG #4) — 스토어/RN 의존 없음, 단위 테스트 대상
// 우선순위: 현재 언어 → 영어(en) 폴백 → 키 자체(미정의 안전망)
export type Dict = Record<string, string>

// 값 타입에 undefined를 허용한다 — 앱 언어(27개) 중 UI 사전이 있는 언어는 일부라
// STRINGS가 Partial<Record<AppLang, Dict>>이기 때문. 조회는 아래에서 옵셔널로 처리한다.
export function lookupString(
  strings: Record<string, Dict | undefined>,
  lang: string,
  key: string,
): string {
  return strings[lang]?.[key] ?? strings.en?.[key] ?? key
}
