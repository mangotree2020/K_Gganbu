// 챌린지 레벨 계산 (REQ-KL-2) — 네이티브 의존 없는 순수 함수.
// store.ts 는 MMKV persist 를 쓰기 때문에 테스트에서 로드할 수 없어 계산만 분리한다.

// 1레벨당 5일 — 학습량을 한 숫자로 보여주기 위한 단순 규칙
export const levelOf = (totalDays: number) => Math.floor(totalDays / 5) + 1
export const levelProgress = (totalDays: number) => (totalDays % 5) / 5
