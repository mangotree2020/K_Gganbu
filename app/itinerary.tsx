// 여행 일정 추천 (PLANNING §6, §19) — 기간/테마별 부산 추천 코스 + 타임라인.
import { useQuery } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon, Pill } from '@/components/brand'
import { PlaceThumb } from '@/components/PlaceThumb'
import {
  generateAiItinerary,
  getItineraries,
  stopCoords,
  type ItinDuration,
  type ItinPrefs,
  type ItinTheme,
  type Itinerary,
} from '@/features/itinerary/services'
import { useLocaleStore, useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

const DURATIONS = ['quick', 'half', 'full']
const THEMES = ['family', 'couple', 'kpop', 'cruise']

// 현재 필터를 AI 생성 선호로 변환 (기간 필터→해당 기간, 테마 필터→해당 테마)
function prefsFromFilter(f: string): ItinPrefs {
  if (DURATIONS.includes(f)) return { duration: f as ItinDuration, theme: 'family' }
  if (THEMES.includes(f)) return { duration: 'half', theme: f as ItinTheme }
  return { duration: 'half', theme: 'family' }
}

// 필터: 전체 + 기간(3종) + 테마(4종). id는 Itinerary의 duration/theme와 매칭.
const FILTERS = [
  { id: 'all', key: 'itin.all' },
  { id: 'quick', key: 'itin.quick' },
  { id: 'half', key: 'itin.half' },
  { id: 'full', key: 'itin.full' },
  { id: 'family', key: 'itin.family' },
  { id: 'couple', key: 'itin.couple' },
  { id: 'kpop', key: 'itin.kpop' },
  { id: 'cruise', key: 'itin.cruise' },
]

const DURATION_KEY: Record<string, string> = {
  quick: 'itin.quick',
  half: 'itin.half',
  full: 'itin.full',
}

export default function ItineraryScreen() {
  const t = useT()
  const lang = useLocaleStore((s) => s.lang)
  const [filter, setFilter] = useState('all')
  const [generated, setGenerated] = useState<Itinerary[]>([])
  const [genLoading, setGenLoading] = useState(false)
  const { data } = useQuery({ queryKey: ['itineraries'], queryFn: getItineraries })

  const shown = useMemo(() => {
    const list = data ?? []
    if (filter === 'all') return list
    return list.filter((c) => c.duration === filter || c.theme === filter)
  }, [data, filter])

  const openStop = (s: Itinerary['stops'][number]) =>
    router.push({
      pathname: '/place',
      params: { name: s.place, sub: s.sub, cat: s.cat },
    })

  // 코스 전체 지도 보기 (UX_REVIEW §4-3) — 좌표 확보된 스팟을 지도 탭에
  // 멀티 핀(순번) + 순서 폴리라인으로 펼친다. 스팟 2개 미만이면 지도만 연다.
  const openCourseMap = (c: Itinerary) => {
    const spots = c.stops
      .map((s) => ({ name: s.place, ...(stopCoords(s.place) ?? {}) }))
      .filter((s): s is { name: string; lat: number; lng: number } => 'lat' in s)
    router.push({
      pathname: '/(tabs)/map',
      params:
        spots.length >= 2 ? { course: JSON.stringify(spots), courseTitle: c.title } : undefined,
    })
  }

  // AI 일정 생성 (PLANNING §18) — 현재 필터를 선호로 사용, 결과를 상단에 누적
  const onGenerate = async () => {
    if (genLoading) return
    setGenLoading(true)
    try {
      const it = await generateAiItinerary(prefsFromFilter(filter), lang)
      setGenerated((prev) => [it, ...prev.filter((p) => p.id !== it.id)])
    } finally {
      setGenLoading(false)
    }
  }

  return (
    <View style={ss.container}>
      <LinearGradient
        colors={['#6366F1', '#8B5CF6', '#0EA5E9']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={ss.header}>
            <View style={ss.headerIcon}>
              <Icon name="event" size={20} color="#fff" filled />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.headerTitle}>{t('itin.title')}</Text>
              <Text style={ss.headerSub}>{t('itin.sub')}</Text>
            </View>
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
        contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 12 }}>
        {/* AI 일정 생성 (PLANNING §18) — 현재 필터를 선호로 사용 */}
        <Pressable
          onPress={onGenerate}
          disabled={genLoading}
          style={[ss.aiBtn, genLoading && { opacity: 0.85 }]}>
          {genLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Icon name="auto_awesome" size={16} color="#fff" filled />
          )}
          <Text style={ss.aiBtnText}>
            {genLoading ? t('itin.aiGenerating') : t('itin.aiGenerate')}
          </Text>
        </Pressable>

        {generated.length === 0 && shown.length === 0 ? (
          <Text style={ss.empty}>{t('itin.empty')}</Text>
        ) : (
          [...generated, ...shown].map((c) => (
            <View key={c.id} style={[ss.card, shadows.card]}>
              <View style={ss.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={ss.cardTitle}>{c.title}</Text>
                  <Text style={ss.cardSub}>
                    {t(DURATION_KEY[c.duration])} · {c.stops.length} {t('itin.stops')}
                  </Text>
                </View>
                <Pill
                  tone={c.generated ? 'teal' : c.theme === 'cruise' ? 'cruise' : 'blue'}
                  size="sm">
                  ✦ {c.generated ? t('itin.aiNew') : t('itin.aiPick')}
                </Pill>
              </View>

              {!!c.aiNote && (
                <View style={ss.aiNote}>
                  <Icon name="auto_awesome" size={13} color={palette.teal[40]} filled />
                  <Text style={ss.aiNoteText}>{c.aiNote}</Text>
                </View>
              )}

              <View style={{ padding: 14 }}>
                {c.stops.map((s, i) => {
                  const isCruise = c.theme === 'cruise' && i === c.stops.length - 1
                  return (
                    <Pressable
                      key={`${s.time}-${s.place}`}
                      onPress={() => openStop(s)}
                      style={({ pressed }) => [
                        { flexDirection: 'row', gap: 10, opacity: pressed ? 0.7 : 1 },
                      ]}>
                      <View style={{ alignItems: 'center', width: 24 }}>
                        <View
                          style={[
                            ss.dot,
                            { backgroundColor: isCruise ? palette.cruise.base : palette.blue[50] },
                          ]}>
                          {isCruise ? (
                            <Icon name="directions_boat" size={13} color="#fff" filled />
                          ) : (
                            <Text style={ss.dotNum}>{i + 1}</Text>
                          )}
                        </View>
                        {i < c.stops.length - 1 && <View style={ss.line} />}
                      </View>
                      <View style={ss.stopThumb}>
                        <PlaceThumb category={s.cat} height={40} />
                      </View>
                      <View style={{ flex: 1, paddingBottom: 12 }}>
                        <Text
                          style={[
                            ss.stopPlace,
                            { color: isCruise ? palette.cruise.base : palette.zinc[900] },
                          ]}>
                          {s.time} · {s.place}
                        </Text>
                        <Text style={ss.stopSub}>{s.sub}</Text>
                      </View>
                      <Icon name="chevron_right" size={16} color={palette.zinc[400]} />
                    </Pressable>
                  )
                })}
              </View>

              <View style={ss.cardFoot}>
                {/* Start = 코스 전체를 지도에 펼쳐 따라가기(멀티 핀 + 순서 폴리라인) */}
                <Pressable style={ss.startBtn} onPress={() => openCourseMap(c)}>
                  <Icon name="map" size={16} color="#fff" filled />
                  <Text style={ss.startText}>{t('itin.start')}</Text>
                </Pressable>
                <Pressable style={ss.customBtn}>
                  <Text style={ss.customText}>{t('itin.customize')}</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
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

  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.teal[40],
    borderRadius: 14,
    paddingVertical: 13,
    ...shadows.card,
  },
  aiBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  aiNote: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 14,
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: palette.teal[95],
    borderWidth: 0.5,
    borderColor: palette.teal[80],
  },
  aiNoteText: { flex: 1, fontSize: 12, color: palette.teal[20], lineHeight: 18 },
  empty: { fontSize: 13, color: palette.zinc[400], textAlign: 'center', marginTop: 48 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    borderRadius: 18,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.zinc[200],
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.2 },
  cardSub: { fontSize: 11, color: palette.zinc[500], marginTop: 2 },
  dot: { width: 24, height: 24, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dotNum: { color: '#fff', fontSize: 11, fontWeight: '700' },
  line: { flex: 1, width: 2, backgroundColor: palette.zinc[200], marginTop: 2 },
  stopThumb: { width: 40, height: 40, borderRadius: 10, overflow: 'hidden' },
  stopPlace: { fontSize: 12.5, fontWeight: '700' },
  stopSub: { fontSize: 10, color: palette.zinc[500], marginTop: 2 },
  cardFoot: { flexDirection: 'row', gap: 8, padding: 14, paddingTop: 0 },
  startBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: palette.blue[50],
    borderRadius: 999,
    paddingVertical: 10,
  },
  startText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  customBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: palette.zinc[300],
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  customText: { color: palette.zinc[800], fontWeight: '700', fontSize: 13 },
})
