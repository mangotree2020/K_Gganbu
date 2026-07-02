// 승선 복귀 알림 (PRD REQ-CR-3) — 로컬 알림 예약(30분 전 + 정각) + 설정 즉시 확인 알림.
// expo-notifications는 네이티브 모듈 → 미포함 구 빌드에서는 lazy require가 실패하므로
// 'unavailable'로 degrade (재빌드 전에도 화면은 동작, 알림만 비활성 안내).
import { Platform } from 'react-native'
import { storage } from '@/lib/mmkv'

const KEY_TIME = 'cruise:return_time'
const KEY_IDS = 'cruise:alarm_ids'

export type AlarmTexts = {
  title: string // 알림 제목 (예: 승선 복귀)
  before: string // 30분 전 본문
  now: string // 정각 본문
  confirmed: string // 설정 직후 확인 알림 본문
}

type Notifications = typeof import('expo-notifications')

let cached: Notifications | null | undefined
function getNotifications(): Notifications | null {
  if (cached !== undefined) return cached
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const n = require('expo-notifications') as Notifications
    // 포그라운드에서도 배너 표시
    n.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    })
    cached = n
  } catch {
    cached = null
  }
  return cached
}

export function getReturnTime(): Date | null {
  const v = storage.getString(KEY_TIME)
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export async function clearReturnAlarm(): Promise<void> {
  const n = getNotifications()
  const raw = storage.getString(KEY_IDS)
  if (n && raw) {
    try {
      for (const id of JSON.parse(raw) as string[]) {
        await n.cancelScheduledNotificationAsync(id).catch(() => {})
      }
    } catch {
      // ignore
    }
  }
  storage.remove(KEY_TIME)
  storage.remove(KEY_IDS)
}

// 알림 예약 — 30분 전(남은 시간이 30분 이상일 때) + 정각. 설정 확인 알림은 즉시 발화.
export async function setReturnAlarm(
  returnTime: Date,
  texts: AlarmTexts,
): Promise<'scheduled' | 'no-permission' | 'unavailable'> {
  const n = getNotifications()
  if (!n) return 'unavailable'
  try {
    const perm = await n.requestPermissionsAsync()
    if (!perm.granted) return 'no-permission'

    await clearReturnAlarm()
    if (Platform.OS === 'android') {
      await n.setNotificationChannelAsync('cruise', {
        name: 'Cruise return',
        importance: n.AndroidImportance.MAX,
        sound: 'default',
      })
    }

    const ids: string[] = []
    const dateTrigger = (date: Date) =>
      ({
        type: n.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: 'cruise',
      }) as const

    const before = new Date(returnTime.getTime() - 30 * 60 * 1000)
    if (before.getTime() > Date.now()) {
      ids.push(
        await n.scheduleNotificationAsync({
          content: { title: texts.title, body: texts.before, sound: 'default' },
          trigger: dateTrigger(before),
        }),
      )
    }
    if (returnTime.getTime() > Date.now()) {
      ids.push(
        await n.scheduleNotificationAsync({
          content: { title: texts.title, body: texts.now, sound: 'default' },
          trigger: dateTrigger(returnTime),
        }),
      )
    }
    // 설정 확인 — 즉시 표시(알림 경로가 살아있는지 사용자에게 피드백)
    await n.scheduleNotificationAsync({
      content: { title: texts.title, body: texts.confirmed, sound: 'default' },
      trigger: null,
    })

    storage.set(KEY_TIME, returnTime.toISOString())
    storage.set(KEY_IDS, JSON.stringify(ids))
    return 'scheduled'
  } catch {
    return 'unavailable'
  }
}
