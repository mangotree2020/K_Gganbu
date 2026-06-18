// 음성 통역 대화 이력 화면 — MMKV에 저장된 지난 세션 목록·대화 조회.
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { clearSessions, loadSessions, type VoiceSession } from '@/features/translate/history'
import { APP_LANGS, useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

const langMeta = (code: string) =>
  APP_LANGS.find((l) => l.code === code) ?? { flag: '🌐', label: code || '?' }

function fmtDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString()
  } catch {
    return ''
  }
}

export default function VoiceHistoryScreen() {
  const t = useT()
  const [sessions, setSessions] = useState<VoiceSession[]>(() => loadSessions())
  const [openId, setOpenId] = useState<number | null>(sessions[0]?.id ?? null)

  const clearAll = () => {
    clearSessions()
    setSessions([])
  }

  return (
    <View style={ss.container}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <View style={ss.header}>
          <View style={ss.headerIcon}>
            <Icon name="history" size={20} color={palette.teal[40]} filled />
          </View>
          <Text style={ss.title}>{t('voice.history')}</Text>
          <View style={ss.headerActions}>
            {sessions.length > 0 && (
              <Pressable onPress={clearAll} hitSlop={8} style={ss.clearBtn}>
                <Text style={ss.clearText}>{t('voice.clearAll')}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => router.back()} style={ss.close}>
              <Icon name="close" size={18} color={palette.zinc[700]} />
            </Pressable>
          </View>
        </View>

        {sessions.length === 0 ? (
          <View style={ss.empty}>
            <Icon name="history" size={40} color={palette.zinc[300]} />
            <Text style={ss.emptyText}>{t('voice.historyEmpty')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={ss.list}>
            {sessions.map((s) => {
              const open = openId === s.id
              const meta = langMeta(s.lang)
              return (
                <View key={s.id} style={[ss.card, shadows.card]}>
                  <Pressable onPress={() => setOpenId(open ? null : s.id)} style={ss.cardHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={ss.cardDate}>{fmtDate(s.at)}</Text>
                      <Text style={ss.cardMeta}>
                        {meta.flag} {meta.label} ·{' '}
                        {t('voice.historyCount').replace('{n}', String(s.turns.length))}
                      </Text>
                    </View>
                    <Icon
                      name={open ? 'expand_more' : 'chevron_right'}
                      size={20}
                      color={palette.zinc[400]}
                    />
                  </Pressable>
                  {open && (
                    <View style={ss.turns}>
                      {s.turns.map((tn, i) => {
                        const m = langMeta(tn.lang)
                        return (
                          <View key={i} style={ss.turn}>
                            <Text style={ss.turnChip}>
                              {m.flag} {m.label}
                            </Text>
                            {!!tn.original && <Text style={ss.turnOrig}>{tn.original}</Text>}
                            <Text style={ss.turnTrans}>{tn.translation}</Text>
                          </View>
                        )
                      })}
                    </View>
                  )}
                </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.zinc[200],
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.teal[95],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: palette.zinc[900],
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  clearText: { fontSize: 13, fontWeight: '700', color: palette.error[50] },
  close: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  emptyText: { fontSize: 14, color: palette.zinc[400] },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    overflow: 'hidden',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  cardDate: { fontSize: 14, fontWeight: '700', color: palette.zinc[900] },
  cardMeta: { fontSize: 12, color: palette.zinc[500], marginTop: 2 },
  turns: {
    borderTopWidth: 0.5,
    borderTopColor: palette.zinc[200],
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  turn: { paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: palette.zinc[100] },
  turnChip: { fontSize: 11, fontWeight: '700', color: palette.teal[40], marginBottom: 3 },
  turnOrig: { fontSize: 12.5, color: palette.zinc[500], lineHeight: 18 },
  turnTrans: {
    fontSize: 14.5,
    fontWeight: '600',
    color: palette.zinc[900],
    lineHeight: 20,
    marginTop: 2,
  },
})
