// 알림함(인박스) 화면 — 인앱 알림 목록/읽음 처리. 모달 라우트.
import { router } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { SheetHeader } from '@/components/SheetHeader'
import { useInboxStore, unreadCount, type NotifType } from '@/features/notifications/inbox'
import { useT } from '@/lib/i18n'
import { palette } from '@/theme/tokens'

// 타입별 아이콘·색상
const TYPE_META: Record<NotifType, { icon: string; color: string; bg: string }> = {
  coupon: { icon: 'confirmation_number', color: palette.coral[50], bg: palette.coral[95] },
  ai: { icon: 'auto_awesome', color: palette.blue[50], bg: palette.blue[95] },
  trip: { icon: 'explore', color: palette.teal[50], bg: palette.teal[95] },
  system: { icon: 'celebration', color: palette.amber[50], bg: palette.amber[90] },
}

function relTime(ts: number, justNow: string): string {
  const h = Math.floor((Date.now() - ts) / 3600_000)
  if (h < 1) return justNow
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function NotificationsScreen() {
  const t = useT()
  const items = useInboxStore((s) => s.items)
  const markRead = useInboxStore((s) => s.markRead)
  const markAllRead = useInboxStore((s) => s.markAllRead)

  const sorted = useMemo(() => [...items].sort((a, b) => b.ts - a.ts), [items])
  const unread = unreadCount(items)

  const onTap = (id: string, route?: string) => {
    markRead(id)
    if (route) router.push(route as never)
  }

  return (
    <View style={ss.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={ss.headerRow}>
          <View style={{ flex: 1 }}>
            <SheetHeader
              title={t('notif.title')}
              icon="notifications"
              accent={palette.coral[50]}
              accentBg={palette.coral[95]}
            />
          </View>
        </View>

        {unread > 0 && (
          <Pressable onPress={markAllRead} style={ss.markAll}>
            <Icon name="check_circle" size={15} color={palette.blue[50]} />
            <Text style={ss.markAllText}>{t('notif.markAllRead')}</Text>
          </Pressable>
        )}

        {sorted.length === 0 ? (
          <View style={ss.empty}>
            <View style={ss.emptyIcon}>
              <Icon name="notifications" size={30} color={palette.zinc[400]} />
            </View>
            <Text style={ss.emptyTitle}>{t('notif.empty')}</Text>
            <Text style={ss.emptySub}>{t('notif.emptySub')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 8 }}>
            {sorted.map((n) => {
              const m = TYPE_META[n.type]
              return (
                <Pressable
                  key={n.id}
                  onPress={() => onTap(n.id, n.route)}
                  style={[ss.card, !n.read && ss.cardUnread]}>
                  <View style={[ss.cardIcon, { backgroundColor: m.bg }]}>
                    <Icon name={m.icon} size={19} color={m.color} filled />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={ss.cardTop}>
                      <Text style={ss.cardTitle} numberOfLines={1}>
                        {t(n.titleKey)}
                      </Text>
                      <Text style={ss.cardTime}>{relTime(n.ts, t('notif.justNow'))}</Text>
                    </View>
                    <Text style={ss.cardBody} numberOfLines={2}>
                      {t(n.bodyKey)}
                    </Text>
                  </View>
                  {!n.read && <View style={ss.dot} />}
                </Pressable>
              )
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  markAllText: { fontSize: 12.5, color: palette.blue[50], fontWeight: '700' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.zinc[200],
    padding: 12,
  },
  cardUnread: { backgroundColor: palette.blue[95], borderColor: palette.blue[90] },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: palette.zinc[900] },
  cardTime: { fontSize: 11, color: palette.zinc[400] },
  cardBody: { fontSize: 12.5, color: palette.zinc[600], marginTop: 2, lineHeight: 17 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: palette.coral[50] },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: palette.zinc[800] },
  emptySub: { fontSize: 12.5, color: palette.zinc[500], textAlign: 'center', lineHeight: 18 },
})
