// 크루즈 고객 설정 (MMKV 영속) — 마이메뉴 토글로 켜면 홈에 크루즈 모드 타일 노출.
// 향후: 터미널 QR 설치 유입(Play Install Referrer의 landing ch=cruise/terminal)이면
// 기본 크루즈 고객으로 자동 설정(REQ-CR — 외부 설정·스토어 연동 후).
import { create } from 'zustand'
import { storage } from '@/lib/mmkv'

const KEY = 'cruise:customer'

export const useCruiseStore = create<{ isCruise: boolean; setCruise: (v: boolean) => void }>(
  (set) => ({
    isCruise: storage.getString(KEY) === '1',
    setCruise: (v) => {
      storage.set(KEY, v ? '1' : '0')
      set({ isCruise: v })
    },
  }),
)
