import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { translateText } from '@/features/translate/services'
import { palette } from '@/theme/tokens'

type Mode = 'text' | 'camera' | 'voice'

// PLANNING §6 1차 언어 (Google Translation 코드)
type LangOpt = { code: string; label: string; flag: string }
const LANG_LIST: LangOpt[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zh-CN', label: '中文(简体)', flag: '🇨🇳' },
  { code: 'zh-TW', label: '中文(繁體)', flag: '🇹🇼' },
]
const LANGS: Record<string, string> = Object.fromEntries(LANG_LIST.map((l) => [l.code, l.label]))
const langLabel = (code: string) => (code === 'auto' ? 'Auto detect' : (LANGS[code] ?? code))

const MOCK: Record<string, string> = {
  'Does this dish contain pork?': '이 음식에 돼지고기가 들어가나요?',
  'Can I have the bill, please?': '계산서 좀 주시겠어요?',
  'Where is the nearest subway?': '가장 가까운 지하철역이 어디에 있나요?',
  'How much is this?': '이거 얼마예요?',
  "I'm allergic to peanuts.": '저는 땅콩 알레르기가 있어요.',
}

const SCENARIOS = [
  {
    k: 'Restaurant',
    ex: 'Menu · Allergy · Bill',
    icon: 'restaurant',
    color: palette.blue[50],
    bg: palette.blue[95],
  },
  {
    k: 'Taxi',
    ex: 'Destination · Receipt',
    icon: 'local_taxi',
    color: palette.coral[50],
    bg: palette.coral[95],
  },
  {
    k: 'Hospital',
    ex: 'Symptoms · Medicine',
    icon: 'medical_services',
    color: '#EC4899',
    bg: '#FCE7F3',
  },
  {
    k: 'Shopping',
    ex: 'Price · Tax-free',
    icon: 'shopping_bag',
    color: palette.teal[40],
    bg: palette.teal[95],
  },
  {
    k: 'Emergency',
    ex: 'Lost · Police',
    icon: 'emergency',
    color: palette.error[50],
    bg: '#FEE2E2',
  },
  { k: 'Hotel', ex: 'Check-in · Room', icon: 'hotel', color: palette.amber[50], bg: '#FEF3C7' },
]

const MODES: { id: Mode; icon: string; label: string }[] = [
  { id: 'text', icon: 'keyboard', label: 'Text' },
  { id: 'camera', icon: 'photo_camera', label: 'Camera' },
  { id: 'voice', icon: 'mic', label: 'Voice' },
]

export default function TranslateScreen() {
  const [mode, setMode] = useState<Mode>('text')
  const [src, setSrc] = useState('en')
  const [tgt, setTgt] = useState('ko')
  const INITIAL_INPUT = 'Does this dish contain pork?'
  const [input, setInput] = useState(INITIAL_INPUT)
  const [output, setOutput] = useState(MOCK[INITIAL_INPUT])
  const [translating, setTranslating] = useState(false)
  const [picker, setPicker] = useState<'src' | 'tgt' | null>(null)

  const pickLang = (code: string) => {
    if (picker === 'src') setSrc(code)
    else if (picker === 'tgt') setTgt(code)
    setPicker(null)
  }

  const doTranslate = async () => {
    if (!input.trim()) return
    setTranslating(true)
    setOutput('')
    const { translatedText } = await translateText({ source: src, target: tgt, text: input })
    setOutput(translatedText)
    setTranslating(false)
  }

  const swap = () => {
    setSrc(tgt)
    setTgt(src)
    setInput(output)
    setOutput(input)
  }

  return (
    <View style={ss.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* 헤더 */}
        <View style={ss.header}>
          <View style={ss.headerIcon}>
            <Icon name="translate" size={20} color={palette.teal[40]} filled />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ss.headerTitle}>Translate</Text>
            <Text style={ss.headerSub}>Camera · Voice · Text · 5 languages</Text>
          </View>
          <Pressable onPress={() => router.back()} style={ss.closeBtn}>
            <Icon name="close" size={18} color={palette.zinc[700]} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* 모드 선택 */}
          <View style={ss.modeRow}>
            {MODES.map((m) => {
              const on = m.id === mode
              return (
                <Pressable
                  key={m.id}
                  onPress={() =>
                    m.id === 'voice' ? router.push('/voice-interpret') : setMode(m.id)
                  }
                  style={[ss.modeBtn, on ? ss.modeBtnOn : ss.modeBtnOff]}>
                  <Icon
                    name={m.icon}
                    size={22}
                    color={on ? palette.teal[30] : palette.zinc[600]}
                    filled={on}
                  />
                  <Text
                    style={[ss.modeLabel, { color: on ? palette.teal[30] : palette.zinc[700] }]}>
                    {m.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {mode === 'text' && (
            <View style={{ paddingHorizontal: 16 }}>
              {/* 언어 행 (탭하여 선택) */}
              <View style={ss.langRow}>
                <Pressable onPress={() => setPicker('src')} style={ss.langPick}>
                  <Text style={ss.langText}>{langLabel(src)}</Text>
                  <Icon name="expand_more" size={16} color={palette.zinc[500]} />
                </Pressable>
                <Pressable onPress={swap} style={ss.swapBtn}>
                  <Icon name="swap_horiz" size={18} color={palette.teal[30]} />
                </Pressable>
                <Pressable onPress={() => setPicker('tgt')} style={ss.langPick}>
                  <Text style={ss.langText}>{langLabel(tgt)}</Text>
                  <Icon name="expand_more" size={16} color={palette.zinc[500]} />
                </Pressable>
              </View>

              {/* 입력 */}
              <View style={ss.inputCard}>
                <Text style={ss.fieldLabel}>{LANGS[src]}</Text>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  multiline
                  placeholder="Type to translate..."
                  placeholderTextColor={palette.zinc[400]}
                  style={ss.inputField}
                />
                <View style={{ alignItems: 'flex-end', marginTop: 6 }}>
                  <Pressable onPress={doTranslate} style={ss.translateBtn}>
                    <Icon name="auto_awesome" size={14} color="#fff" filled />
                    <Text style={ss.translateBtnText}>Translate</Text>
                  </Pressable>
                </View>
              </View>

              {/* 출력 */}
              <LinearGradient
                colors={['#F0FDFA', '#CCFBF1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={ss.outputCard}>
                <Text style={[ss.fieldLabel, { color: palette.teal[30] }]}>
                  {langLabel(tgt)} · Google
                </Text>
                {translating ? (
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
                    {[0, 1, 2].map((i) => (
                      <View key={i} style={ss.dot} />
                    ))}
                  </View>
                ) : (
                  <Text style={ss.outputText}>{output}</Text>
                )}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                  {[
                    { icon: 'content_copy', label: 'Copy' },
                    { icon: 'volume_up', label: 'Play' },
                    { icon: 'bookmark_add', label: 'Save' },
                  ].map((b) => (
                    <View key={b.label} style={ss.outputAction}>
                      <Icon name={b.icon} size={14} color={palette.teal[30]} />
                      <Text style={ss.outputActionText}>{b.label}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </View>
          )}

          {mode === 'camera' && (
            <View style={ss.placeholder}>
              <View style={ss.placeholderIcon}>
                <Icon name="photo_camera" size={36} color={palette.teal[40]} filled />
              </View>
              <Text style={ss.placeholderTitle}>Camera translate</Text>
              <Text style={ss.placeholderSub}>
                Point at a menu or sign — OCR + live translation coming soon
              </Text>
            </View>
          )}

          {/* 상황별 문구 */}
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <Text style={ss.sectionLabel}>SITUATION PHRASES</Text>
            <View style={ss.scenarioGrid}>
              {SCENARIOS.map((s) => (
                <Pressable
                  key={s.k}
                  onPress={() =>
                    router.push({
                      pathname: '/phrases',
                      params: { id: s.k.toLowerCase(), lang: tgt === 'ko' ? 'en' : tgt },
                    })
                  }
                  style={({ pressed }) => [
                    ss.scenarioCard,
                    { backgroundColor: s.bg, borderTopColor: s.color, opacity: pressed ? 0.9 : 1 },
                  ]}>
                  <Icon name={s.icon} size={20} color={s.color} filled />
                  <Text style={ss.scenarioTitle}>{s.k}</Text>
                  <Text style={ss.scenarioEx}>{s.ex}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ height: 24 }} />
        </ScrollView>

        {/* 언어 선택 모달 */}
        <Modal
          visible={picker !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setPicker(null)}>
          <Pressable style={ss.modalBg} onPress={() => setPicker(null)}>
            <View style={ss.sheet}>
              <Text style={ss.sheetTitle}>
                {picker === 'src' ? 'Translate from' : 'Translate to'}
              </Text>
              {picker === 'src' && (
                <Pressable
                  onPress={() => pickLang('auto')}
                  style={[ss.langOpt, src === 'auto' && ss.langOptOn]}>
                  <Text style={{ fontSize: 20 }}>🌐</Text>
                  <Text style={ss.langOptText}>Auto detect</Text>
                  {src === 'auto' && (
                    <Icon name="check_circle" size={18} color={palette.teal[40]} filled />
                  )}
                </Pressable>
              )}
              {LANG_LIST.map((l) => {
                const cur = picker === 'src' ? src : tgt
                return (
                  <Pressable
                    key={l.code}
                    onPress={() => pickLang(l.code)}
                    style={[ss.langOpt, cur === l.code && ss.langOptOn]}>
                    <Text style={{ fontSize: 20 }}>{l.flag}</Text>
                    <Text style={ss.langOptText}>{l.label}</Text>
                    {cur === l.code && (
                      <Icon name="check_circle" size={18} color={palette.teal[40]} filled />
                    )}
                  </Pressable>
                )
              })}
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  )
}

const ss = StyleSheet.create({
  langPick: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 32,
    gap: 4,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.3,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  langOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  langOptOn: { backgroundColor: '#F0FDFA' },
  langOptText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#18181B' },
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
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, color: palette.zinc[900] },
  headerSub: { fontSize: 12, color: palette.zinc[500], marginTop: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },

  modeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  modeBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  modeBtnOn: { backgroundColor: palette.teal[90], borderWidth: 2, borderColor: palette.teal[40] },
  modeBtnOff: {
    backgroundColor: palette.zinc[50],
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  modeLabel: { fontSize: 11, fontWeight: '600' },

  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.zinc[50],
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 6,
    marginBottom: 10,
  },
  langText: { fontSize: 13, fontWeight: '600', color: palette.zinc[800] },
  swapBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: palette.teal[90],
    alignItems: 'center',
    justifyContent: 'center',
  },

  inputCard: {
    backgroundColor: palette.zinc[50],
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: palette.zinc[500],
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputField: { fontSize: 16, color: palette.zinc[900], lineHeight: 22, padding: 0, minHeight: 44 },
  translateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: palette.teal[40],
  },
  translateBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  outputCard: {
    borderWidth: 0.5,
    borderColor: palette.teal[80],
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    minHeight: 90,
  },
  outputText: {
    fontSize: 16,
    fontWeight: '500',
    color: palette.teal[10],
    lineHeight: 22,
    marginTop: 2,
  },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: palette.teal[40] },
  outputAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 0.5,
    borderColor: palette.teal[80],
    backgroundColor: 'rgba(255,255,255,.7)',
    borderRadius: 10,
    paddingVertical: 6,
  },
  outputActionText: { fontSize: 11, fontWeight: '600', color: palette.teal[30] },

  placeholder: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 32, gap: 10 },
  placeholderIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: palette.teal[95],
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderTitle: { fontSize: 16, fontWeight: '800', color: palette.zinc[900] },
  placeholderSub: { fontSize: 13, color: palette.zinc[500], textAlign: 'center', lineHeight: 19 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.zinc[500],
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  scenarioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scenarioCard: {
    width: '47.5%',
    borderRadius: 14,
    padding: 12,
    gap: 6,
    borderTopWidth: 3,
  },
  scenarioTitle: { fontSize: 12, fontWeight: '700', color: palette.zinc[900] },
  scenarioEx: { fontSize: 10, color: palette.zinc[500] },
})
