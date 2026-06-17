// 티켓 (PLANNING §6·§19) — 카테고리별 목록 + 외부 예매 아웃링크.
import { useQuery } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon, Pill } from '@/components/brand'
import { FallbackBadge } from '@/components/FallbackBadge'
import { PlaceThumb } from '@/components/PlaceThumb'
import { getTickets, type Ticket } from '@/features/ticket/services'
import { useT } from '@/lib/i18n'
import { USE_MOCK } from '@/lib/config'
import { palette, shadows } from '@/theme/tokens'

const FILTERS = [
  { id: 'all', key: 'ticket.all' },
  { id: 'attraction', key: 'ticket.attraction' },
  { id: 'tour', key: 'ticket.tour' },
  { id: 'show', key: 'ticket.show' },
  { id: 'transport', key: 'ticket.transport' },
]

const CAT_KEY: Record<string, string> = {
  attraction: 'ticket.attraction',
  tour: 'ticket.tour',
  show: 'ticket.show',
  transport: 'ticket.transport',
}

export default function TicketsScreen() {
  const t = useT()
  const [filter, setFilter] = useState('all')
  const { data } = useQuery({ queryKey: ['tickets'], queryFn: getTickets })

  const shown = useMemo(() => {
    const list = data ?? []
    return filter === 'all' ? list : list.filter((x) => x.category === filter)
  }, [data, filter])

  const book = (x: Ticket) => Linking.openURL(x.outlinkUrl).catch(() => {})
  const price = (x: Ticket) => `₩${x.price.toLocaleString()}`

  return (
    <View style={ss.container}>
      <LinearGradient
        colors={['#0EA5E9', '#0284C7', '#0D9488']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={ss.header}>
            <View style={ss.headerIcon}>
              <Icon name="confirmation_number" size={20} color="#fff" filled />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.headerTitle}>{t('ticket.title')}</Text>
              <Text style={ss.headerSub}>{t('ticket.sub')}</Text>
            </View>
            {USE_MOCK && <FallbackBadge label="Sample" />}
            <Pressable onPress={() => router.back()} style={ss.close}>
              <Icon name="close" size={18} color="#fff" />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 18, paddingBottom: 16 }}>
            {FILTERS.map((f) => {
              const on = f.id === filter
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  style={[ss.chip, on && ss.chipOn]}>
                  <Text style={[ss.chipText, { color: on ? palette.blue[50] : '#fff' }]}>
                    {t(f.key)}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 10 }}>
        {shown.map((x) => (
          <View key={x.id} style={[ss.card, shadows.card]}>
            <View style={ss.thumb}>
              <PlaceThumb category={x.thumb} height={64} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.name}>{x.title}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
                <Pill tone="blue" size="xs">
                  {t(CAT_KEY[x.category])}
                </Pill>
                <Pill tone="neutral" size="xs">
                  {x.provider}
                </Pill>
              </View>
              <Text style={ss.price}>{price(x)}</Text>
            </View>
            <Pressable
              onPress={() => book(x)}
              style={({ pressed }) => [ss.bookBtn, { opacity: pressed ? 0.9 : 1 }]}>
              <Icon name="open_in_new" size={14} color="#fff" filled />
              <Text style={ss.bookText}>{t('ticket.book')}</Text>
            </Pressable>
          </View>
        ))}
        <Text style={ss.outlinkNote}>{t('ticket.outlink')}</Text>
      </ScrollView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,.92)', marginTop: 2 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.4)',
    backgroundColor: 'rgba(255,255,255,.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipOn: { backgroundColor: '#fff' },
  chipText: { fontSize: 12, fontWeight: '700' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  thumb: { width: 64, height: 64, borderRadius: 14, overflow: 'hidden' },
  name: { fontSize: 14, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.1 },
  price: { fontSize: 14, fontWeight: '800', color: palette.blue[50], marginTop: 6 },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: palette.blue[50],
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    ...shadows.blue,
  },
  bookText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  outlinkNote: { fontSize: 11, color: palette.zinc[400], textAlign: 'center', marginTop: 6 },
})
