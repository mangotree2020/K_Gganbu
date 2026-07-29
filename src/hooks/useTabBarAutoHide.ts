// 하단 탭바 자동 숨김 — X(트위터)식 스크롤 반응.
// 위로 플릭(콘텐츠 아래로 스크롤)하면 탭바 숨김, 아래로 플릭하면 다시 표시.
// 스크롤 화면은 useTabBarAutoHide()의 핸들러를 ScrollView에 스프레드하면 끝.
import { useRef } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { create } from 'zustand'

export const useTabBarStore = create<{ hidden: boolean; setHidden: (v: boolean) => void }>(
  (set) => ({
    hidden: false,
    setHidden: (v) => set((s) => (s.hidden === v ? s : { hidden: v })),
  }),
)

const SHOW_NEAR_TOP = 24 // 최상단 부근에서는 항상 표시
const THRESHOLD = 8 // 미세 스크롤 떨림 무시(플릭 판정 최소 이동량)

export function useTabBarAutoHide() {
  const setHidden = useTabBarStore((s) => s.setHidden)
  const lastY = useRef(0)
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // nativeEvent 방어 — RN Fabric은 SyntheticEvent를 풀링해 디스패치 후 nativeEvent를 null로
    // 비운다. 이벤트를 지연 참조(updater·비동기 콜백)하면 죽으므로 동기 접근 + null 방어만 허용
    // (릴리스에서 map 화면이 "Cannot read property 'layout' of null"로 죽었던 원인 — map.tsx 주석 참조)
    const ne = e?.nativeEvent
    if (!ne?.contentOffset || !ne.contentSize || !ne.layoutMeasurement) return
    const y = ne.contentOffset.y
    const dy = y - lastY.current
    // 바닥 오버스크롤 바운스 무시
    const maxY = ne.contentSize.height - ne.layoutMeasurement.height - SHOW_NEAR_TOP
    if (y <= SHOW_NEAR_TOP) setHidden(false)
    else if (dy > THRESHOLD && y < Math.max(maxY, SHOW_NEAR_TOP)) setHidden(true)
    else if (dy < -THRESHOLD) setHidden(false)
    lastY.current = y
  }
  return { onScroll, scrollEventThrottle: 16 as const }
}
