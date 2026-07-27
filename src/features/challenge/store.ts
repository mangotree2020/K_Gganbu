// 챌린지 진도·연속 출석 (PRD REQ-KL-2) — MMKV persist.
// 로컬을 진실의 원본으로 두되, 보상 적립은 서버(포인트 원장)가 하루 1회 멱등으로 강제하므로
// 기기 조작으로 포인트를 더 받을 수는 없다(로컬은 표시·동기부여용).
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { zustandStorage } from '@/lib/mmkv'
import { todayKey } from './daily'

// 어제 날짜(KST) — streak 연속 판정용
function yesterdayKey(): string {
  return todayKey(new Date(Date.now() - 24 * 3600_000))
}

interface ChallengeState {
  lastDone: string | null // 마지막 완료 날짜(KST)
  streak: number // 연속 일수
  bestStreak: number
  totalDays: number // 누적 완료 일수 (레벨 산정)
  complete: (correct: number) => void
}

export const useChallengeStore = create<ChallengeState>()(
  persist(
    (set) => ({
      lastDone: null,
      streak: 0,
      bestStreak: 0,
      totalDays: 0,
      complete: () =>
        set((s) => {
          const today = todayKey()
          if (s.lastDone === today) return s // 하루 1회만 진도 반영
          const streak = s.lastDone === yesterdayKey() ? s.streak + 1 : 1
          return {
            lastDone: today,
            streak,
            bestStreak: Math.max(s.bestStreak, streak),
            totalDays: s.totalDays + 1,
          }
        }),
    }),
    { name: 'challenge-progress', storage: createJSONStorage(() => zustandStorage) },
  ),
)

// 레벨 계산은 순수 모듈(level.ts)에 두고 재노출 — 기존 import 경로 유지 + 테스트 가능
export { levelOf, levelProgress } from './level'
