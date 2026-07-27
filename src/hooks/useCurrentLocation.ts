// 현재 GPS 위치 — expo-location (just-in-time 권한, 거부 시 부산 폴백)
import { useCallback, useEffect, useRef, useState } from 'react'
import * as Location from 'expo-location'

export type Coords = { latitude: number; longitude: number }

// 부산 해운대 폴백 (위치 거부/실패 시)
export const BUSAN_FALLBACK: Coords = { latitude: 35.1587, longitude: 129.1604 }

export function useCurrentLocation() {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [granted, setGranted] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const aliveRef = useRef(true)

  // 실제 GPS 측정 — 권한 확인/요청 후 고정밀(High) 위치를 새로 읽는다.
  // 성공 시 최신 좌표 반환(실패/거부 시 null). 내 위치 버튼이 탭마다 이걸 호출해
  // 최초 1회 캐시·폴백 좌표에 고정되는 문제를 막는다.
  const locate = useCallback(async (): Promise<Coords | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (!aliveRef.current) return null
      if (status !== 'granted') {
        setGranted(false)
        // 이미 잡힌 실좌표가 있으면 폴백으로 덮지 않음
        setCoords((c) => c ?? BUSAN_FALLBACK)
        return null
      }
      setGranted(true)
      // 마지막으로 알려진 위치를 먼저 반영(거리 정렬 등 즉시 사용) — 지도 센터링은
      // 아래 고정밀 측정이 끝난 뒤(loading=false) 이뤄지므로 이 값으로 고정되지 않는다
      const known = await Location.getLastKnownPositionAsync()
      if (!aliveRef.current) return null
      if (known) setCoords({ latitude: known.coords.latitude, longitude: known.coords.longitude })
      // 고정밀 측정이 실내 등에서 오래 걸릴 수 있어 8초 타임아웃 — 실패 시 last known/폴백 유지
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<null>((r) => setTimeout(() => r(null), 8000)),
      ])
      if (!aliveRef.current) return null
      if (!pos) {
        if (known) return { latitude: known.coords.latitude, longitude: known.coords.longitude }
        setCoords((c) => c ?? BUSAN_FALLBACK)
        return null
      }
      const next = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
      setCoords(next)
      return next
    } catch {
      if (aliveRef.current) setCoords((c) => c ?? BUSAN_FALLBACK)
      return null
    } finally {
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
