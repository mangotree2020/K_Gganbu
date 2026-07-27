// 포인트 발행 규칙 (BM§3.5) — 네이티브 의존이 없는 순수 계산.
// pedometer.ts 는 MMKV·센서를 쓰기 때문에 테스트에서 로드할 수 없다. 규칙만 여기로 분리해
// 단위 테스트(jest, node 환경)로 고정한다 — 이 숫자가 틀리면 사용자 손해이거나 발행 원가가 샌다.
// 서버(points EF)의 상수와 동일해야 하며, 화면의 "예상 P"도 이 함수를 쓴다.

export const STEP_POINT_UNIT = 1000 // 1,000보당
export const STEP_POINT_PER_UNIT = 10 // 10P 적립
export const STEP_POINT_DAILY_CAP = 100 // 일 상한 100P

export const stepsToPoints = (steps: number): number =>
  Math.min(STEP_POINT_DAILY_CAP, Math.floor(steps / STEP_POINT_UNIT) * STEP_POINT_PER_UNIT)
