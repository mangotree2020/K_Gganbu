// 포인트 경제 계산 규칙 (REQ-PD-2·PT-3·GS-2) — 숫자가 틀리면 사용자가 손해를 보거나
// 발행 원가가 새는 지점이라 단위 테스트로 고정한다. 서버가 최종 판정을 하지만,
// 화면에 "예상 P"로 먼저 보이는 값이라 앱 쪽 계산도 서버 규칙과 같아야 한다.
import { pointUsableFor, POINT_USE_RATE } from '@/features/gifticon/services'
import { levelOf, levelProgress } from '@/features/challenge/level'
import { stepsToPoints, STEP_POINT_DAILY_CAP } from '@/features/points/rules'

describe('걸음 → 포인트 (BM§3.5 발행 캡)', () => {
  it('1,000보당 10P로 환산하고 미만은 버린다', () => {
    expect(stepsToPoints(0)).toBe(0)
    expect(stepsToPoints(999)).toBe(0) // 1,000보 미만은 적립 없음
    expect(stepsToPoints(1000)).toBe(10)
    expect(stepsToPoints(5500)).toBe(50) // 500보는 버림
  })

  it('일 상한(100P)을 넘지 않는다 — 발행 총량 가드', () => {
    expect(stepsToPoints(10_000)).toBe(STEP_POINT_DAILY_CAP)
    expect(stepsToPoints(50_000)).toBe(STEP_POINT_DAILY_CAP)
    expect(stepsToPoints(1_000_000)).toBe(STEP_POINT_DAILY_CAP)
  })
})

describe('기프티콘 포인트 사용 상한 (등급별)', () => {
  it('등급 미지정이면 기본 30%', () => {
    expect(pointUsableFor(10_000)).toBe(10_000 * POINT_USE_RATE)
  })

  it('등급 상한을 그대로 반영한다 (friend 35 / bestie 40 / gganbu 50)', () => {
    expect(pointUsableFor(10_000, 35)).toBe(3_500)
    expect(pointUsableFor(10_000, 40)).toBe(4_000)
    expect(pointUsableFor(10_000, 50)).toBe(5_000)
  })

  it('원 단위로 내림한다 (부분 원 방지)', () => {
    expect(pointUsableFor(3_333, 35)).toBe(1_166) // 1166.55 → 1166
    expect(Number.isInteger(pointUsableFor(9_999, 50))).toBe(true)
  })
})

describe('챌린지 레벨 (REQ-KL-2)', () => {
  it('5일마다 한 레벨씩 오른다', () => {
    expect(levelOf(0)).toBe(1)
    expect(levelOf(4)).toBe(1)
    expect(levelOf(5)).toBe(2)
    expect(levelOf(12)).toBe(3)
  })

  it('진행도는 0~1 사이이며 레벨업 직후 0으로 돌아간다', () => {
    expect(levelProgress(0)).toBe(0)
    expect(levelProgress(2)).toBeCloseTo(0.4)
    expect(levelProgress(5)).toBe(0)
    expect(levelProgress(9)).toBeCloseTo(0.8)
  })
})
