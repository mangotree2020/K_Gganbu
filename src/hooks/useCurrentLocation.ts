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
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })
      if (!aliveRef.current) return null
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
