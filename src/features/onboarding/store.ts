// 온보딩 상태 — 언어/지역/관심사 (PLANNING §2, §218). MMKV persist.
// 완료 여부로 루트 레이아웃이 온보딩 게이트를 판단한다.
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { zustandStorage } from '@/lib/mmkv'

export type RegionId = 'busan' | 'seoul' | 'jeju' | 'gyeongju' | 'incheon' | 'other'
export type InterestId =
  | 'food'
  | 'kculture'
  | 'shopping'
  | 'nature'
  | 'cruise'
  | 'history'
  | 'nightlife'
  | 'photo'

type OnboardingState = {
  completed: boolean
  region: RegionId | null
  interests: InterestId[]
  setRegion: (region: RegionId) => void
  toggleInterest: (id: InterestId) => void
  complete: () => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      region: null,
      interests: [],
      setRegion: (region) => set({ region }),
      toggleInterest: (id) =>
        set((s) => ({
          interests: s.interests.includes(id)
            ? s.interests.filter((i) => i !== id)
            : [...s.interests, id],
        })),
      complete: () => set({ completed: true }),
      reset: () => set({ completed: false, region: null, interests: [] }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
)
