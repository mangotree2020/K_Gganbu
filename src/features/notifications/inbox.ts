// 인앱 알림함(inbox) — 알림 메시지 목록/읽음 상태. MMKV persist.
// 실 FCM 연동 전까지는 seed로 채우며, 수신 시 add()로 추가하는 구조(mock-first).
// 콘텐츠는 i18n 키로 저장해 언어 전환에 대응한다.
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { zustandStorage } from '@/lib/mmkv'

export type NotifType = 'coupon' | 'ai' | 'trip' | 'system'

export type NotifItem = {
  id: string
  type: NotifType
  titleKey: string // i18n 키
  bodyKey: string // i18n 키
  ts: number // epoch ms
  read: boolean
  route?: string // 탭 시 이동할 라우트(선택)
}

const HOUR = 3600_000
const now = Date.now()

// 초기 seed(첫 실행). 이후 add()로 실 알림 누적.
const SEED: NotifItem[] = [
  {
    id: 'n-ai',
    type: 'ai',
    titleKey: 'notif.aiTitle',
    bodyKey: 'notif.aiBody',
    ts: now - 1 * HOUR,
    read: false,
    route: '/(tabs)/ai',
  },
  {
    id: 'n-coupon',
    type: 'coupon',
    titleKey: 'notif.couponTitle',
    bodyKey: 'notif.couponBody',
    ts: now - 5 * HOUR,
    read: false,
    route: '/(tabs)/coupons',
  },
  {
    id: 'n-welcome',
    type: 'system',
    titleKey: 'notif.welcomeTitle',
    bodyKey: 'notif.welcomeBody',
    ts: now - 26 * HOUR,
    read: false,
  },
]

interface InboxState {
  items: NotifItem[]
  add: (item: Omit<NotifItem, 'ts' | 'read'> & { ts?: number }) => void
  markRead: (id: string) => void
  markAllRead: () => void
  remove: (id: string) => void
  clear: () => void
}

export const useInboxStore = create<InboxState>()(
  persist(
    (set) => ({
      items: SEED,
      add: (item) =>
        set((s) => ({
          items: [{ ...item, ts: item.ts ?? Date.now(), read: false }, ...s.items].slice(0, 50),
        })),
      markRead: (id) =>
        set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllRead: () => set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),
      remove: (id) => set((s) => ({ items: s.items.filter((n) => n.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'inbox-store',
      storage: createJSONStorage(() => zustandStorage),
      version: 1,
    },
  ),
)

// 미읽음 개수 selector
export const unreadCount = (items: NotifItem[]) => items.filter((n) => !n.read).length
