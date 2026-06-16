// 현재 GPS 위치 — expo-location (just-in-time 권한, 거부 시 부산 폴백)
import { useEffect, useState } from 'react'
import * as Location from 'expo-location'

export type Coords = { latitude: number; longitude: number }

// 부산 해운대 폴백 (위치 거부/실패 시)
export const BUSAN_FALLBACK: Coords = { latitude: 35.1587, longitude: 129.1604 }

export function useCurrentLocation() {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [granted, setGranted] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (!alive) return
        if (status !== 'granted') {
          setGranted(false)
          setCoords(BUSAN_FALLBACK)
          return
        }
        setGranted(true)
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        if (!alive) return
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
      } catch {
        if (alive) setCoords(BUSAN_FALLBACK)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return { coords: coords ?? BUSAN_FALLBACK, granted, loading }
}
