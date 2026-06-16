import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { findScenario, type Lang, type Phrase } from '@/features/translate/phrases'
import { palette } from '@/theme/tokens'

const UI_LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-CN', label: '简体' },
  { code: 'zh-TW', label: '繁體' },
]

export default function PhrasesScreen() {
  const p = useLocalSearchParams<{ id?: string; lang?: string }>()
  const scenario = findScenario(p.id)
  const [lang, setLang] = useState<Lang>((p.lang as Lang) || 'en')
  const [show, setShow] = useState<Phrase | null>(null)

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

        {/* 언어 선택 */}
        <View style={ss.langRow}>
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
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 10 }}>
          {scenario.phrases.map((ph, i) => (
            <Pressable
              key={i}
              onPress={() => setShow(ph)}
              style={({ pressed }) => [ss.card, { opacity: pressed ? 0.92 : 1 }]}>
              <View style={{ flex: 1 }}>
                <Text style={ss.cardLang}>{ph[lang]}</Text>
                <Text style={ss.cardKo}>{ph.ko}</Text>
              </View>
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
  cardKo: { fontSize: 13, color: palette.zinc[500], marginTop: 3 },
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
