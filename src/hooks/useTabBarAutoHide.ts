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
    const y = e.nativeEvent.contentOffset.y
    const dy = y - lastY.current
    // 바닥 오버스크롤 바운스 무시
    const maxY =
      e.nativeEvent.contentSize.height - e.nativeEvent.layoutMeasurement.height - SHOW_NEAR_TOP
    if (y <= SHOW_NEAR_TOP) setHidden(false)
    else if (dy > THRESHOLD && y < Math.max(maxY, SHOW_NEAR_TOP)) setHidden(true)
    else if (dy < -THRESHOLD) setHidden(false)
    lastY.current = y
  }
  return { onScroll, scrollEventThrottle: 16 as const }
}
