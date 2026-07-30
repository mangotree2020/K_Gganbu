// 만보기 (PRD REQ-PD-1·3, BM§5 S-6 포인트 경제) — 오늘 걸음수 + 예상 포인트 표시용.
// 포인트 규칙: 1,000보 = 10P, 일 상한 100P (BM§3.5 발행 캡). 실제 적립은 R2 포인트 원장에서.
// 플랫폼 차이: iOS는 CoreMotion 일일 조회 지원. Android는 expo-sensors가 일일 조회를
// 미지원(watchStepCount만) → ① Health Connect 일일 합계(있으면 1순위, healthConnect.ts)
// ② 없으면 구독 델타를 MMKV에 일자별 누적(앱 사용 중에만 측정되는 한계).
// 부정 필터 1차(보상형 만보기 연구 반영): 분당 인정 걸음 상한으로 흔들기·차량 진동 등
// 비정상 폭증을 클램프. 정밀 검증(Activity Recognition·GPS 속도·신뢰 점수)은
// R2 서버 적립(verified_steps) 단계에서 적용.
// 모듈 미포함 구 빌드·권한 거부·미지원 기기는 null 반환 → 위젯 숨김(graceful degrade).
import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { storage } from '@/lib/mmkv'
import { readTodaySteps } from './healthConnect'

// 발행 규칙은 순수 모듈(rules.ts)에 두고 여기서 재노출한다 — 기존 import 경로 유지 + 테스트 가능
export { STEP_POINT_UNIT, STEP_POINT_PER_UNIT, STEP_POINT_DAILY_CAP, stepsToPoints } from './rules'

// 분당 인정 걸음 상한 — 정상 보행/달리기 상단(연구 권고 220보/분) 초과분은 버림
const MAX_STEPS_PER_MIN = 220

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

export type TodaySteps = {
  steps: number | null // 사용 불가 상태(모듈/권한/기기)면 null
  walking: boolean // 최근 수 초 내 걸음 감지 — 홈 도보 아이콘 애니메이션용
}

// 오늘 걸음수 + 걷는 중 여부
export function useTodaySteps(): TodaySteps {
  const [steps, setSteps] = useState<number | null>(null)
  const [walking, setWalking] = useState(false)
  const walkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const Pedometer = getPedometer()
    if (!Pedometer) return
    let sub: { remove: () => void } | null = null
    let alive = true

    // 걸음 이벤트 수신 시 "걷는 중" 4초 유지(이후 자동 해제)
    const markWalking = () => {
      if (!alive) return
      setWalking(true)
      if (walkTimerRef.current) clearTimeout(walkTimerRef.current)
      walkTimerRef.current = setTimeout(() => alive && setWalking(false), 4000)
    }

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
            if (alive) {
              setSteps(base + w.steps)
              markWalking()
            }
          })
        } else {
          // Android 1순위: Health Connect 일일 합계(앱을 꺼 둔 동안의 걸음까지 포함).
          // 미설치·권한 거부·미지원이면 null → 아래 누적 방식으로 자동 폴백한다.
          const hcSteps = await readTodaySteps()
          if (hcSteps != null) {
            if (alive) setSteps(hcSteps)
            // 실시간 증가는 구독으로 보여주되, 합계의 기준은 Health Connect 값이다
            let seen = 0
            sub = Pedometer.watchStepCount((w) => {
              const d = w.steps - seen
              seen = w.steps
              if (d > 0 && alive) {
                setSteps((cur) => (cur ?? hcSteps) + d)
                markWalking()
              }
            })
            return
          }

          // Android 폴백: 구독 시작 이후 델타를 일자별로 누적 보관.
          // 분당 상한을 넘는 델타는 초과분을 버려(클램프) 흔들기·진동 폭증을 1차 차단.
          // 걸음 콜백은 기기에 따라 걸음마다 올 수 있어 MMKV write·setState를 매번 하면
          // 걷는 내내 지속 부하가 된다 → 누적은 로컬 변수, 반영은 1초 스로틀로 묶는다.
          let key = dayKey(now)
          let cur = Number(storage.getString(key) ?? '0')
          if (alive) setSteps(cur)
          let last = 0
          let lastAt = Date.now()
          let flushTimer: ReturnType<typeof setTimeout> | null = null
          // 자정 경계 — 콜백마다 오늘 키를 재판정해, 넘어갔으면 전날 값을 저장하고 새 키로 전환
          // (키를 구독 시작 시점에 고정하면 자정 이후 걸음이 전날에 계속 쌓인다)
          const rollDayIfNeeded = () => {
            const nowKey = dayKey(new Date())
            if (nowKey !== key) {
              storage.set(key, String(cur))
              key = nowKey
              cur = Number(storage.getString(key) ?? '0')
            }
          }
          const flush = () => {
            flushTimer = null
            rollDayIfNeeded()
            storage.set(key, String(cur))
            if (alive) {
              setSteps(cur)
              markWalking()
            }
          }
          sub = Pedometer.watchStepCount((w) => {
            const t = Date.now()
            const rawDelta = w.steps - last
            last = w.steps
            if (rawDelta <= 0) return
            const elapsedMin = Math.max((t - lastAt) / 60000, 1 / 60) // 최소 1초 창
            lastAt = t
            rollDayIfNeeded()
            cur += Math.min(rawDelta, Math.ceil(MAX_STEPS_PER_MIN * elapsedMin))
            if (!flushTimer) flushTimer = setTimeout(flush, 1000)
          })
          const baseRemove = sub.remove.bind(sub)
          // 구독 해제 시 대기 중인 반영분을 즉시 저장(마지막 1초 유실 방지)
          sub = {
            remove: () => {
              if (flushTimer) {
                clearTimeout(flushTimer)
                flush()
              }
              baseRemove()
            },
          }
        }
      } catch {
        // 미지원 기기 — 위젯 숨김 유지
      }
    })()
    return () => {
      alive = false
      if (walkTimerRef.current) clearTimeout(walkTimerRef.current)
      sub?.remove()
    }
  }, [])

  return { steps, walking }
}
