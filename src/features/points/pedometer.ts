// 만보기 (PRD REQ-PD-1·3, BM§5 S-6 포인트 경제) — 오늘 걸음수 + 예상 포인트 표시용.
// 포인트 규칙: 1,000보 = 10P, 일 상한 100P (BM§3.5 발행 캡). 실제 적립은 R2 포인트 원장에서.
// 플랫폼 차이: iOS는 CoreMotion 일일 조회 지원. Android는 expo-sensors가 일일 조회를
// 미지원(watchStepCount만) → 구독 델타를 MMKV에 일자별 누적(앱 사용 중 측정,
// R2에서 Health Connect 전환 검토 — PRD REQ-PD 비고).
// 모듈 미포함 구 빌드·권한 거부·미지원 기기는 null 반환 → 위젯 숨김(graceful degrade).
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { storage } from '@/lib/mmkv'

export const STEP_POINT_UNIT = 1000 // 1,000보당
export const STEP_POINT_PER_UNIT = 10 // 10P 적립
export const STEP_POINT_DAILY_CAP = 100 // 일 상한 100P

export const stepsToPoints = (steps: number): number =>
  Math.min(STEP_POINT_DAILY_CAP, Math.floor(steps / STEP_POINT_UNIT) * STEP_POINT_PER_UNIT)

type PedometerModule = typeof import('expo-sensors').Pedometer

function getPedometer(): PedometerModule | null {
  try {
    // 네이티브 미포함 빌드에서 로드 실패를 흡수 — lazy require
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('expo-sensors') as typeof import('expo-sensors')).Pedometer
  } catch {
    return null
  }
}

const dayKey = (d: Date) =>
  `steps:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// 오늘 걸음수 — 사용 불가 상태(모듈/권한/기기)면 null
export function useTodaySteps(): number | null {
  const [steps, setSteps] = useState<number | null>(null)

  useEffect(() => {
    const Pedometer = getPedometer()
    if (!Pedometer) return
    let sub: { remove: () => void } | null = null
    let alive = true
    ;(async () => {
      try {
        if (!(await Pedometer.isAvailableAsync())) return
        const perm = await Pedometer.requestPermissionsAsync()
        if (!perm.granted) return
        const now = new Date()
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)

        if (Platform.OS === 'ios') {
          // 자정 이후 총보수 + 이후 실시간 증가분
          const r = await Pedometer.getStepCountAsync(start, now)
          const base = r.steps
          if (alive) setSteps(base)
          sub = Pedometer.watchStepCount((w) => {
            if (alive) setSteps(base + w.steps)
          })
        } else {
          // Android: 구독 시작 이후 델타를 일자별로 누적 보관
          const key = dayKey(now)
          if (alive) setSteps(Number(storage.getString(key) ?? '0'))
          let last = 0
          sub = Pedometer.watchStepCount((w) => {
            const delta = w.steps - last
            last = w.steps
            if (delta > 0) {
              const cur = Number(storage.getString(key) ?? '0') + delta
              storage.set(key, String(cur))
              if (alive) setSteps(cur)
            }
          })
        }
      } catch {
        // 미지원 기기 — 위젯 숨김 유지
      }
    })()
    return () => {
      alive = false
      sub?.remove()
    }
  }, [])

  return steps
}
