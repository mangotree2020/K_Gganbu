// 현재 GPS 위치 — expo-location (just-in-time 권한, 거부 시 부산 폴백)
import { useCallback, useEffect, useRef, useState } from 'react'
import * as Location from 'expo-location'

export type Coords = { latitude: number; longitude: number }

// 부산 해운대 폴백 (위치 거부/실패 시)
export const BUSAN_FALLBACK: Coords = { latitude: 35.1587, longitude: 129.1604 }

// 고정밀 측정 타임아웃 — 실내·지하상가에서 오래 걸릴 수 있어 여기서 끊고 last known/폴백 사용
const FIX_TIMEOUT_MS = 8000
// 마지막으로 알려진 위치의 허용 나이·정확도. 무제한으로 받으면 어제 있던 도시 좌표로
// 주변 추천·거리 정렬이 통째로 어긋난다(공항→시내 이동 직후가 대표적).
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000
const LAST_KNOWN_MAX_ACCURACY_M = 300

// 측정 결과 — 권한 거부와 측정 실패를 구분한다(거부는 지역 수동 선택 degrade 대상)
type Fix = { granted: boolean; coords: Coords | null }

// 진행 중인 측정 — 화면 여러 곳(지도·홈·AI·통역)이 동시에 훅을 쓰면 GPS 요청이 그만큼
// 중복 발생한다. 측정은 앱 전체에서 하나만 돌리고 결과를 공유한다.
let inflight: Promise<Fix> | null = null
// 고정밀 측정 전에 나오는 대략 좌표를 구독자 전원에게 알린다(거리 정렬을 8초까지 기다리지 않도록).
// 측정 도중 합류한 구독자도 즉시 받을 수 있도록 마지막 값을 함께 들고 있는다.
const interimListeners = new Set<(c: Coords) => void>()
let interimCoords: Coords | null = null

async function measure(): Promise<Fix> {
  interimCoords = null
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') return { granted: false, coords: null }

  // 권한은 승인됐다 — 이후 측정이 실패해도 granted는 true다(권한 거부와 측정 실패는 다른 degrade)
  let knownCoords: Coords | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const known = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: LAST_KNOWN_MAX_ACCURACY_M,
    })
    if (known) {
      knownCoords = { latitude: known.coords.latitude, longitude: known.coords.longitude }
      // 대략 좌표 선반영 — 지도 센터링은 loading=false(고정밀 확정) 이후라 이 값으로 고정되지 않는다
      interimCoords = knownCoords
      for (const fn of interimListeners) fn(knownCoords)
    }

    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((r) => {
        timer = setTimeout(() => r(null), FIX_TIMEOUT_MS)
      }),
    ])
    if (!pos) return { granted: true, coords: knownCoords }
    return {
      granted: true,
      coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
    }
  } catch {
    return { granted: true, coords: knownCoords }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function useCurrentLocation() {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [granted, setGranted] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const aliveRef = useRef(true)

  // 실제 GPS 측정 — 권한 확인/요청 후 고정밀 위치를 새로 읽는다.
  // 성공 시 최신 좌표 반환(실패/거부 시 null). 내 위치 버튼이 탭마다 이걸 호출해
  // 최초 1회 캐시·폴백 좌표에 고정되는 문제를 막는다.
  const locate = useCallback(async (): Promise<Coords | null> => {
    const onInterim = (c: Coords) => {
      if (aliveRef.current) setCoords(c)
    }
    interimListeners.add(onInterim)
    // 동시 호출은 같은 측정을 공유한다(중복 GPS 요청 방지)
    const mine = inflight ?? measure()
    inflight = mine
    // 이미 발행된 대략 좌표가 있으면 늦게 합류해도 바로 받는다
    if (interimCoords) onInterim(interimCoords)
    try {
      const fix = await mine
      if (!aliveRef.current) return null
      setGranted(fix.granted)
      if (!fix.coords) {
        // 이미 잡힌 실좌표가 있으면 폴백으로 덮지 않음
        setCoords((c) => c ?? BUSAN_FALLBACK)
        return null
      }
      setCoords(fix.coords)
      return fix.coords
    } catch {
      if (aliveRef.current) setCoords((c) => c ?? BUSAN_FALLBACK)
      return null
    } finally {
      interimListeners.delete(onInterim)
      // 내가 시작한 측정만 해제한다 — 다른 호출자가 이미 새 측정을 걸었다면 그것을 살려둔다
      if (inflight === mine) inflight = null
      if (aliveRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    aliveRef.current = true
    // setState는 모두 await 이후에 실행돼 동기 캐스케이드가 아님(규칙 오탐)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void locate()
    return () => {
      aliveRef.current = false
    }
  }, [locate])

  return { coords: coords ?? BUSAN_FALLBACK, granted, loading, refresh: locate }
}
