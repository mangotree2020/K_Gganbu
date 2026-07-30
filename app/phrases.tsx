import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { isRtlLang } from '@/features/translate/langs'
import { findScenario, type Lang, type Phrase } from '@/features/translate/phrases'
import { storage } from '@/lib/mmkv'
import { palette } from '@/theme/tokens'

// 즐겨 쓰는 문장 로컬 저장 (MMKV) — ko 문장을 키로 보관
const FAV_KEY = 'fav_phrases'
const loadFavs = (): string[] => {
  try {
    return JSON.parse(storage.getString(FAV_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

// 회화 대역 언어 칩 — 한국어(ko)는 상대에게 보여주는 원문이라 선택 대상이 아니다.
// 칩은 좁은 라벨(EN/简体)을 쓰므로 langs.ts의 원어 라벨 대신 별도 표기.
const UI_LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-CN', label: '简体' },
  { code: 'zh-TW', label: '繁體' },
  { code: 'vi', label: 'Việt' },
  { code: 'th', label: 'ไทย' },
  { code: 'id', label: 'Indo' },
  { code: 'ms', label: 'Melayu' },
  { code: 'fil', label: 'Filipino' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'ne', label: 'नेपाली' },
  { code: 'ar', label: 'العربية' },
  { code: 'ru', label: 'Русский' },
  { code: 'mn', label: 'Монгол' },
  { code: 'uz', label: "O'zbek" },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'yue', label: '廣東話' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'km', label: 'ខ្មែរ' },
  { code: 'my', label: 'မြန်မာ' },
  { code: 'kk', label: 'Қазақша' },
]

export default function PhrasesScreen() {
  const p = useLocalSearchParams<{ id?: string; lang?: string }>()
  const scenario = findScenario(p.id)
  const [lang, setLang] = useState<Lang>((p.lang as Lang) || 'en')
  const [show, setShow] = useState<Phrase | null>(null)
  const [favs, setFavs] = useState<string[]>(loadFavs)
  const rtl = isRtlLang(lang) // 아랍어 — 우측 정렬

  const toggleFav = (ko: string) => {
    setFavs((prev) => {
      const next = prev.includes(ko) ? prev.filter((k) => k !== ko) : [...prev, ko]
      storage.set(FAV_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <View style={ss.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* 헤더 */}
        <View style={ss.header}>
          <View style={[ss.headerIcon, { backgroundColor: scenario.bg }]}>
            <Icon name={scenario.icon} size={20} color={scenario.color} filled />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ss.title}>{scenario.title}</Text>
            <Text style={ss.sub}>Tap a phrase to show it in Korean</Text>
          </View>
          <Pressable onPress={() => router.back()} style={ss.close}>
            <Icon name="close" size={18} color={palette.zinc[700]} />
          </Pressable>
        </View>

        {/* 언어 선택 — 21개라 한 줄에 안 들어가므로 가로 스크롤 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={ss.langScroll}
          contentContainerStyle={ss.langRow}>
          {UI_LANGS.map((l) => {
            const on = l.code === lang
            return (
              <Pressable
                key={l.code}
                onPress={() => setLang(l.code)}
                style={[ss.langChip, on && ss.langChipOn]}>
                <Text style={[ss.langChipText, on && { color: '#fff' }]}>{l.label}</Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 10 }}>
          {scenario.phrases.map((ph, i) => (
            <Pressable
              key={i}
              onPress={() => setShow(ph)}
              style={({ pressed }) => [ss.card, { opacity: pressed ? 0.92 : 1 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[ss.cardLang, rtl && ss.rtlText]}>{ph[lang]}</Text>
                <Text style={ss.cardKo}>{ph.ko}</Text>
              </View>
              <Pressable onPress={() => toggleFav(ph.ko)} hitSlop={8} style={ss.starBtn}>
                <Icon
                  name="bookmark"
                  size={20}
                  color={favs.includes(ph.ko) ? palette.amber[50] : palette.zinc[300]}
                  filled={favs.includes(ph.ko)}
                />
              </Pressable>
              <View style={[ss.showBtn, { backgroundColor: scenario.color }]}>
                <Icon name="present_to_all" size={18} color="#fff" filled />
              </View>
            </Pressable>
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>

      {/* 보여주기 모드 — 한국어 크게 (상대에게 핸드오프) */}
      <Modal visible={!!show} animationType="fade" onRequestClose={() => setShow(null)}>
        <Pressable style={ss.showModal} onPress={() => setShow(null)}>
          <SafeAreaView style={ss.showInner}>
            <View style={ss.showTop}>
              <Icon name="present_to_all" size={18} color="rgba(255,255,255,0.7)" filled />
              <Text style={ss.showHint}>Show this to staff · tap to close</Text>
            </View>
            <Text style={ss.showKo}>{show?.ko}</Text>
            <Text style={ss.showLang}>{show?.[lang]}</Text>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.zinc[200],
    backgroundColor: '#fff',
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.3 },
  sub: { fontSize: 12, color: palette.zinc[500], marginTop: 1 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 가로 스크롤이 세로 공간을 먹지 않도록 flexGrow 차단
  langScroll: { flexGrow: 0 },
  langRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  langChipOn: { backgroundColor: palette.teal[40], borderColor: palette.teal[40] },
  langChipText: { fontSize: 13, fontWeight: '700', color: palette.zinc[700] },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  cardLang: { fontSize: 15, fontWeight: '700', color: palette.zinc[900], letterSpacing: -0.2 },
  // RTL 언어(아랍어) — 문자 자체는 RN이 bidi로 처리하고, 정렬만 우측으로
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  cardKo: { fontSize: 13, color: palette.zinc[500], marginTop: 3 },
  starBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  showModal: { flex: 1, backgroundColor: palette.zinc[900] },
  showInner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  showTop: { position: 'absolute', top: 24, flexDirection: 'row', alignItems: 'center', gap: 6 },
  showHint: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  showKo: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 50,
    letterSpacing: -0.5,
  },
  showLang: { fontSize: 16, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 20 },
})
