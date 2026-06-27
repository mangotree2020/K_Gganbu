// 사용자 프로필(로컬) — 아바타·성별·출생연도. MMKV persist.
// 아바타는 (1) 직접 촬영/선택한 사진 URI, (2) 미설정 시 12지신 기본(성별·출생연도 기반).
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { zustandStorage } from '@/lib/mmkv'
import type { Gender } from './zodiac'

export type AvatarKind = 'photo' | 'zodiac'

interface ProfileState {
  displayName: string
  gender: Gender
  birthYear: number | null
  // 직접 선택한 사진 URI (있으면 우선 표시). null이면 12지신 기본 사용.
  photoUri: string | null
  setProfile: (
    p: Partial<Pick<ProfileState, 'displayName' | 'gender' | 'birthYear' | 'photoUri'>>,
  ) => void
  setPhoto: (uri: string | null) => void
  reset: () => void
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      displayName: '',
      gender: 'female',
      birthYear: null,
      photoUri: null,
      setProfile: (p) => set(p),
      setPhoto: (photoUri) => set({ photoUri }),
      reset: () => set({ displayName: '', gender: 'female', birthYear: null, photoUri: null }),
    }),
    {
      name: 'user-profile',
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
)

// 현재 아바타 종류 (사진 우선)
export function avatarKind(s: Pick<ProfileState, 'photoUri'>): AvatarKind {
  return s.photoUri ? 'photo' : 'zodiac'
}
