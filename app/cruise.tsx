import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon, Pill } from '@/components/brand'
import { useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

const STOPS = [
  {
    n: '1',
    time: '09:30',
    place: 'Gamcheon Culture Village',
    sub: 'Photo spot · ~60min',
    cruise: false,
  },
  { n: '2', time: '11:00', place: 'Jagalchi Fish Market', sub: 'Seafood · ~60min', cruise: false },
  {
    n: '3',
    time: '12:30',
    place: 'BIFF Square + street food',
    sub: 'Lunch · ~45min',
    cruise: false,
  },
  {
    n: '🚢',
    time: '13:30',
    place: 'Return to Busan Port',
    sub: '30min buffer included',
    cruise: true,
  },
]

const QUICK = [
  {
    key: 'cruise.qTranslate',
    icon: 'translate',
    bg: palette.coral[95],
    color: palette.coral[50],
    border: palette.coral[80],
  },
  {
    key: 'cruise.qPort',
    icon: 'navigation',
    bg: palette.cruise[90],
    color: palette.cruise.base,
    border: '#93C5FD',
  },
  {
    key: 'cruise.qCoupons',
    icon: 'confirmation_number',
    bg: '#FEF3C7',
    color: palette.amber[50],
    border: '#FCD34D',
  },
]

export default function CruiseScreen() {
  const t = useT()
  const [hours, setHours] = useState(4)
  return (
    <View style={ss.container}>
      <LinearGradient colors={['#1D4ED8', '#0EA5E9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={ss.header}>
            <View style={ss.headerIcon}>
              <Icon name="directions_boat" size={20} color="#fff" filled />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.headerTitle}>{t('cruise.title')}</Text>
              <Text style={ss.headerSub}>{t('cruise.sub')}</Text>
            </View>
            <Pressable onPress={() => router.back()} style={ss.close}>
              <Icon name="close" size={18} color="#fff" />
            </Pressable>
          </View>

          {/* 타이머 */}
          <View style={ss.timer}>
            {[
              { lbl: t('cruise.return'), val: '15:00', color: '#fff' },
              { lbl: t('cruise.remaining'), val: '5h 18m', color: '#fff' },
              { lbl: t('cruise.statusLabel'), val: t('cruise.onTour'), color: '#86EFAC' },
            ].map((b) => (
              <View key={b.lbl}>
                <Text style={ss.timerLbl}>{b.lbl}</Text>
                <Text style={[ss.timerVal, { color: b.color }]}>{b.val}</Text>
              </View>
            ))}
          </View>

          {/* 시간 탭 */}
          <View style={ss.hoursRow}>
            {[4, 6, 8].map((h) => {
              const on = h === hours
              return (
                <Pressable
                  key={h}
                  onPress={() => setHours(h)}
                  style={[ss.hourBtn, { backgroundColor: on ? '#fff' : 'rgba(255,255,255,.18)' }]}>
                  <Text
                    style={{
                      fontWeight: '700',
                      fontSize: 12,
                      color: on ? palette.cruise.base : '#fff',
                    }}>
                    {h} {t('cruise.hours')}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View style={[ss.itinCard, shadows.card]}>
          <View style={ss.itinHead}>
            <View style={{ flex: 1 }}>
              <Text style={ss.itinTitle}>Gamcheon → Jagalchi → BIFF</Text>
              <Text style={ss.itinSub}>
                {hours} {t('cruise.itinSuffix')}
              </Text>
            </View>
            <Pill tone="cruise" size="sm">
              ✦ {t('cruise.aiPick')}
            </Pill>
          </View>
          <View style={{ padding: 14 }}>
            {STOPS.map((s, i) => (
              <View key={s.n} style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ alignItems: 'center', width: 24 }}>
                  <View
                    style={[
                      ss.stopDot,
                      { backgroundColor: s.cruise ? palette.cruise.base : palette.blue[50] },
                    ]}>
                    {s.cruise ? (
                      <Icon name="directions_boat" size={13} color="#fff" filled />
                    ) : (
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{s.n}</Text>
                    )}
                  </View>
                  {i < STOPS.length - 1 && <View style={ss.stopLine} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 10 }}>
                  <Text
                    style={[
                      ss.stopPlace,
                      { color: s.cruise ? palette.cruise.base : palette.zinc[900] },
                    ]}>
                    {s.time} · {s.place}
                  </Text>
                  <Text style={ss.stopSub}>{s.sub}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, padding: 14, paddingTop: 0 }}>
            <Pressable style={ss.startBtn}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                {t('cruise.startTour')}
              </Text>
            </Pressable>
            <Pressable style={ss.customBtn}>
              <Text style={{ color: palette.zinc[800], fontWeight: '700', fontSize: 13 }}>
                {t('cruise.customize')}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {QUICK.map((q) => (
            <View
              key={q.key}
              style={[ss.quickBtn, { backgroundColor: q.bg, borderColor: q.border }]}>
              <Icon name={q.icon} size={18} color={q.color} filled />
              <Text style={[ss.quickLabel, { color: q.color }]}>{t(q.key)}</Text>
            </View>
          ))}
        </View>
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
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,.92)', marginTop: 2 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.22)',
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 16,
    marginHorizontal: 18,
    marginTop: 12,
  },
  timerLbl: { fontSize: 9, color: 'rgba(255,255,255,.8)', letterSpacing: 0.8 },
  timerVal: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  hoursRow: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 18,
    marginTop: 12,
    paddingBottom: 16,
  },
  hourBtn: { flex: 1, borderRadius: 999, paddingVertical: 8, alignItems: 'center' },

  itinCard: {
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    borderRadius: 18,
    overflow: 'hidden',
  },
  itinHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.zinc[200],
  },
  itinTitle: { fontSize: 13, fontWeight: '700', color: palette.zinc[900] },
  itinSub: { fontSize: 10, color: palette.zinc[500], marginTop: 2 },
  stopDot: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopLine: { flex: 1, width: 2, backgroundColor: palette.zinc[200], marginTop: 2 },
  stopPlace: { fontSize: 12, fontWeight: '700' },
  stopSub: { fontSize: 10, color: palette.zinc[500], marginTop: 2 },
  startBtn: {
    flex: 1,
    backgroundColor: palette.blue[50],
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  customBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: palette.zinc[300],
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 4,
  },
  quickLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
})
