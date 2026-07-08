// 깐부 라이브(청취) 전역 상태 — "깐부가 귀 기울이고 있다" 개념의 단일 스위치 (표준 모듈)
// 홈 히어로 깐부 아이콘으로 토글하며, 모든 깐부 음성 접점이 이 상태를 따른다:
//   · 홈: 인사말·질문 낭독(TTS)
//   · AI 깐부 탭: 화면 진입 시 자동 음성 청취
//   · 통역: "깐부" 웨이크워드 질문·4턴 자문·답변 TTS
// OFF = 깐부 휴면(듣지도 말하지도 않음). MMKV persist로 세션 간 유지.
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { zustandStorage } from '@/lib/mmkv'

type GganbuLive = {
  active: boolean
  toggle: () => void
  setActive: (v: boolean) => void
}

export const useGganbuLive = create<GganbuLive>()(
  persist(
    (set, get) => ({
      active: true,
      toggle: () => set({ active: !get().active }),
      setActive: (v) => set({ active: v }),
    }),
    { name: 'gganbu-live', storage: createJSONStorage(() => zustandStorage) },
  ),
)

// 콜백·이펙트에서 리렌더 없이 현재 상태 조회
export const isGganbuActive = () => useGganbuLive.getState().active
