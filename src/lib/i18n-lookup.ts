// i18n 문자열 조회 순수 로직 (BACKLOG #4) — 스토어/RN 의존 없음, 단위 테스트 대상
// 우선순위: 현재 언어 → 영어(en) 폴백 → 키 자체(미정의 안전망)
export type Dict = Record<string, string>

export function lookupString(strings: Record<string, Dict>, lang: string, key: string): string {
  return strings[lang]?.[key] ?? strings.en?.[key] ?? key
}
