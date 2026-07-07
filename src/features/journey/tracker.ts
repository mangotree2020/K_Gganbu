// 길찾기 이동 트래킹 (PRD REQ-LOC-1·2) — 위치 마커 실시간 갱신 + 경로 기록·업로드
// 갱신 주기: 4초 + 5m 이동 조건(둘 다 충족 시 콜백) — 3~5초 요구를 배터리 최적으로 충족.
// 경로는 MMKV(journey:current)에 누적(크래시 복구), 종료 시 다운샘플 후 walk_journeys 업로드.
// 어뷰징·노이즈 필터: GPS 점프(>30m/s) 무시, 평균 12km/h 초과(차량)면 업로드 스킵(서버 check와 동일 기준).
import { useCallback, useEffect, useRef, useState } from 'react'
import * as Location from 'expo-location'
import { storage } from '@/lib/mmkv'
import { supabase } from '@/lib/supabase'

export type JourneyPoint = { lat: number; lng: number; t: number }
export type JourneySummary = {
  distanceM: number
  durationMs: number
  points: number
  saved: boolean // 서버 업로드 여부 (짧은 이동·차량 속도·게스트 프로필 없음 등은 false)
}

const CURRENT_KEY = 'journey:current'
const MAX_JUMP_M_PER_S = 30 // GPS 튐 필터 (순간 108km/h 초과 점프 무시)
const MAX_WALK_M_PER_S = 3.4 // 평균 12.2km/h — 초과 시 도보로 인정하지 않음 (DB check 동일)
const MIN_SAVE_M = 100 // 100m 미만 이동은 노이즈로 간주, 업로드 생략
const MIN_SAVE_MS = 30_000
const MAX_PATH_POINTS = 200 // 업로드 경로 다운샘플 상한

function hav(a: JourneyPoint, b: JourneyPoint): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

// 균등 간격 다운샘플 — 서버 저장 경로 용량 상한
function downsample(pts: JourneyPoint[], max: number): { lat: number; lng: number }[] {
  if (pts.length <= max) return pts.map((p) => ({ lat: p.lat, lng: p.lng }))
  const step = (pts.length - 1) / (max - 1)
  const out: { lat: number; lng: number }[] = []
  for (let i = 0; i < max; i++) {
    const p = pts[Math.round(i * step)]
    out.push({ lat: p.lat, lng: p.lng })
  }
  return out
}

export function useJourneyTracker(onLocation?: (lat: number, lng: number) => void) {
  const subRef = useRef<Location.LocationSubscription | null>(null)
  const ptsRef = useRef<JourneyPoint[]>([])
  const distRef = useRef(0)
  const [tracking, setTracking] = useState(false)
  const onLocationRef = useRef(onLocation)
  useEffect(() => {
    onLocationRef.current = onLocation
  }, [onLocation])

  const start = useCallback(async () => {
    if (subRef.current) return // 이미 트래킹 중
    // 권한은 지도 진입 시 이미 요청됨(useCurrentLocation) — 상태만 확인, 미허용이면 조용히 스킵
    const { status } = await Location.getForegroundPermissionsAsync()
    if (status !== 'granted') return
    ptsRef.current = []
    distRef.current = 0
    try {
      subRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 4000, // 4초 — 3~5초 요구의 중간값
          distanceInterval: 5, // 5m 미만 이동은 콜백 생략 (정지 시 배터리 절약)
        },
        (pos) => {
          const p: JourneyPoint = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            t: Date.now(),
          }
          const prev = ptsRef.current[ptsRef.current.length - 1]
          if (prev) {
            const d = hav(prev, p)
            const dt = (p.t - prev.t) / 1000
            if (dt > 0 && d / dt > MAX_JUMP_M_PER_S) return // GPS 튐 — 무시
            distRef.current += d
          }
          ptsRef.current.push(p)
          storage.set(CURRENT_KEY, JSON.stringify({ pts: ptsRef.current, dist: distRef.current }))
          onLocationRef.current?.(p.lat, p.lng)
        },
      )
      setTracking(true)
    } catch {
      // 위치 서비스 꺼짐 등 — 트래킹 없이 길찾기만 동작
    }
  }, [])

  const stop = useCallback(async (): Promise<JourneySummary | null> => {
    subRef.current?.remove()
    subRef.current = null
    setTracking(false)
    storage.remove(CURRENT_KEY)

    const pts = ptsRef.current
    ptsRef.current = []
    const distanceM = Math.round(distRef.current)
    distRef.current = 0
    if (pts.length < 2) return null

    const durationMs = pts[pts.length - 1].t - pts[0].t
    const summary: JourneySummary = { distanceM, durationMs, points: pts.length, saved: false }
    // 노이즈·차량 이동은 랭킹에 올리지 않음
    if (distanceM < MIN_SAVE_M || durationMs < MIN_SAVE_MS) return summary
    if (distanceM / (durationMs / 1000) > MAX_WALK_M_PER_S) return summary

    try {
      const { data: me } = await supabase.from('users').select('id').single()
      if (!me?.id) return summary
      const { error } = await supabase.from('walk_journeys').insert({
        user_id: me.id,
        started_at: new Date(pts[0].t).toISOString(),
        ended_at: new Date(pts[pts.length - 1].t).toISOString(),
        distance_m: distanceM,
        duration_ms: durationMs,
        path: downsample(pts, MAX_PATH_POINTS),
      })
      summary.saved = !error
    } catch {
      // 네트워크 실패 — 이번 이동은 유실 허용 (v2: pending 큐 재시도)
    }
    return summary
  }, [])

  return { tracking, start, stop }
}
