// 위치 핑 (PRD REQ-LOC-3) — 앱 사용 중 10분 간격 위치를 서버에 기록.
// 위치기반 이벤트(근접 딜 푸시·지오펜스 쿠폰)의 데이터 원천.
// 개인정보: 위치 권한 허용 + 설정 토글(기본 on) 이중 게이트, 서버 보관 90일 자동 삭제(RLS 본인만).
// foreground 전용 — 백그라운드 수집 없음(앱 활성 상태에서만, 심사·배터리·프라이버시 리스크 최소화).
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import * as Location from 'expo-location'
import { storage } from '@/lib/mmkv'
import { supabase } from '@/lib/supabase'

const PING_INTERVAL_MS = 10 * 60 * 1000 // 10분
const LAST_PING_KEY = 'journey:lastPing' // 앱 재시작 간에도 간격 유지
export const PINGS_ENABLED_KEY = 'journey:pingsEnabled' // 설정 토글 (기본 on)

export const isPingsEnabled = () => storage.getString(PINGS_ENABLED_KEY) !== 'off'
export const setPingsEnabled = (on: boolean) => storage.set(PINGS_ENABLED_KEY, on ? 'on' : 'off')

async function sendPing() {
  try {
    if (!isPingsEnabled()) return
    const { status } = await Location.getForegroundPermissionsAsync()
    if (status !== 'granted') return
    const last = Number(storage.getString(LAST_PING_KEY) ?? '0')
    if (Date.now() - last < PING_INTERVAL_MS) return
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    const { data: me } = await supabase.from('users').select('id').single()
    if (!me?.id) return
    const { error } = await supabase.from('location_pings').insert({
      user_id: me.id,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
    })
    if (!error) storage.set(LAST_PING_KEY, String(Date.now()))
  } catch {
    // 실패는 조용히 — 다음 주기에 재시도
  }
}

// 탭 셸에 1회 마운트 — 활성 상태에서만 주기 동작, 백그라운드 전환 시 타이머 정지
export function useLocationPings() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const startTimer = () => {
      if (timerRef.current) return
      sendPing() // 즉시 1회 (간격 미달이면 내부에서 스킵)
      timerRef.current = setInterval(sendPing, 60_000) // 1분마다 체크, 실제 전송은 10분 간격
    }
    const stopTimer = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    startTimer()
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') startTimer()
      else stopTimer()
    })
    return () => {
      stopTimer()
      sub.remove()
    }
  }, [])
}
