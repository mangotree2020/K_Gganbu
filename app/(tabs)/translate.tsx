import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { FallbackBadge } from '@/components/FallbackBadge'
import { detectText } from '@/features/translate/ocr'
import { translateText } from '@/features/translate/services'
import { useT } from '@/lib/i18n'
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

// 순서: Voice → Camera → Text(한국어 학습). Voice가 기본 선택
const MODES: { id: Mode; icon: string; label: string }[] = [
  { id: 'voice', icon: 'mic', label: 'Voice' },
  { id: 'camera', icon: 'photo_camera', label: 'Camera' },
  { id: 'text', icon: 'keyboard', label: 'K-Talk Quest' },
]

export default function TranslateScreen() {
  const t = useT()
  const [mode, setMode] = useState<Mode>('voice')
  const [src, setSrc] = useState('en')
  const [tgt, setTgt] = useState('ko')
  const INITIAL_INPUT = 'Does this dish contain pork?'
  const [input, setInput] = useState(INITIAL_INPUT)
  const [output, setOutput] = useState(MOCK[INITIAL_INPUT])
  const [outputMock, setOutputMock] = useState(false)
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
    const { translatedText, provider } = await translateText({
      source: src,
      target: tgt,
      text: input,
    })
    setOutput(translatedText)
    setOutputMock(provider === 'mock')
    setTranslating(false)
  }

  const swap = () => {
    setSrc(tgt)
    setTgt(src)
    setInput(output)
    setOutput(input)
  }

  // 카메라 OCR 상태
  const [shotUri, setShotUri] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [ocrOut, setOcrOut] = useState('')
  const [ocrMock, setOcrMock] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)

  // 촬영/갤러리 → OCR → 번역 (메뉴·간판은 한국어 가정 → 사용자 언어)
  const runOcr = async (from: 'camera' | 'library') => {
    const perm =
      from === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return

    const opts: ImagePicker.ImagePickerOptions = { base64: true, quality: 0.6 }
    const res =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts)
    if (res.canceled || !res.assets?.[0]?.base64) return

    setShotUri(res.assets[0].uri)
    setOcrText('')
    setOcrOut('')
    setOcrLoading(true)
    const { text, provider: ocrProvider } = await detectText(res.assets[0].base64)
    setOcrText(text)
    const outTgt = tgt === 'ko' ? 'en' : tgt
    const { translatedText, provider: trProvider } = await translateText({
      source: 'ko',
      target: outTgt,
      text,
    })
    setOcrOut(translatedText)
    // OCR 또는 번역 중 하나라도 폴백이면 샘플 표시
    setOcrMock(ocrProvider === 'mock' || trProvider === 'mock')
    setOcrLoading(false)
  }

  // 언어 설정 스위치 박스 — text/voice 모드 공용
  const langSwitcher = (
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
  )

  return (
    <View style={ss.container}>
      {/* 헤더 — 통역 전용색(Teal) 그라데이션이 상태바 영역까지(퀵 타일 상세와 동일 스타일) */}
      <LinearGradient
        colors={['#5EEAD4', '#14B8A6', '#0F766E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={ss.gheader}>
            <View style={ss.gheaderIcon}>
              <Icon name="translate" size={20} color="#fff" filled />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.gheaderTitle}>{t('translate.title')}</Text>
              <Text style={ss.gheaderSub}>{t('translate.subtitle')}</Text>
            </View>
            <Pressable onPress={() => router.back()} style={ss.gclose}>
              <Icon name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* 모드 선택 */}
          <View style={ss.modeRow}>
            {MODES.map((m) => {
              const on = m.id === mode
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMode(m.id)}
                  style={[ss.modeBtn, on ? ss.modeBtnOn : ss.modeBtnOff]}>
                  <Icon name={m.icon} size={22} color={on ? palette.teal[30] : palette.zinc[600]} />
                  <Text
                    style={[ss.modeLabel, { color: on ? palette.teal[30] : palette.zinc[700] }]}>
                    {t(`translate.mode${m.id.charAt(0).toUpperCase()}${m.id.slice(1)}`)}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {mode === 'voice' && (
            <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
              {/* 언어 설정 스위치 박스 */}
              {langSwitcher}

              {/* 통역 전단계 — Start 시 풀스크린 라이브 세션으로 이동 */}
              <View style={ss.voiceCard}>
                <View style={ss.voiceMic}>
                  <Icon name="mic" size={32} color={palette.teal[40]} filled />
                </View>
                <Text style={ss.voiceTitle}>{t('voice.realtimeTitle')}</Text>
                <Text style={ss.voiceSub}>{t('voice.realtimeSub')}</Text>
                <Pressable onPress={() => router.push('/voice-interpret')} style={ss.voiceStart}>
                  <Icon name="mic" size={18} color="#fff" filled />
                  <Text style={ss.voiceStartText}>{t('voice.start')}</Text>
                </Pressable>
              </View>
            </View>
          )}

          {mode === 'text' && (
            <View style={{ paddingHorizontal: 16 }}>
              {/* 언어 행 (탭하여 선택) */}
              {langSwitcher}

              {/* 입력 */}
              <View style={ss.inputCard}>
                <Text style={ss.fieldLabel}>{LANGS[src]}</Text>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  multiline
                  placeholder={t('translate.placeholder')}
                  placeholderTextColor={palette.zinc[400]}
                  style={ss.inputField}
                />
                <View style={{ alignItems: 'flex-end', marginTop: 6 }}>
                  <Pressable onPress={doTranslate} style={ss.translateBtn}>
                    <Icon name="auto_awesome" size={14} color="#fff" filled />
                    <Text style={ss.translateBtnText}>{t('translate.cta')}</Text>
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
                {!translating && outputMock && (
                  <FallbackBadge label="Sample translation" style={{ marginTop: 8 }} />
                )}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                  {[
                    { icon: 'content_copy', label: 'translate.copy' },
                    { icon: 'volume_up', label: 'translate.play' },
                    { icon: 'bookmark_add', label: 'translate.save' },
                  ].map((b) => (
                    <View key={b.label} style={ss.outputAction}>
                      <Icon name={b.icon} size={14} color={palette.teal[30]} />
                      <Text style={ss.outputActionText}>{t(b.label)}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </View>
          )}

          {mode === 'camera' && (
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              {/* 미리보기 / 안내 */}
              {shotUri ? (
                <Image source={{ uri: shotUri }} style={ss.ocrPreview} resizeMode="cover" />
              ) : (
                <View style={ss.ocrHint}>
                  <View style={ss.placeholderIcon}>
                    <Icon name="photo_camera" size={32} color={palette.teal[40]} filled />
                  </View>
                  <Text style={ss.placeholderTitle}>{t('translate.pointCamera')}</Text>
                  <Text style={ss.placeholderSub}>{t('translate.ocrSub')}</Text>
                </View>
              )}

              {/* 촬영 / 갤러리 버튼 */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <Pressable style={ss.ocrBtn} onPress={() => runOcr('camera')}>
                  <Icon name="photo_camera" size={18} color="#fff" filled />
                  <Text style={ss.ocrBtnText}>{t('translate.takePhoto')}</Text>
                </Pressable>
                <Pressable style={ss.ocrBtnAlt} onPress={() => runOcr('library')}>
                  <Icon name="photo_library" size={18} color={palette.teal[30]} />
                  <Text style={ss.ocrBtnAltText}>{t('translate.gallery')}</Text>
                </Pressable>
              </View>

              {/* 결과 */}
              {ocrLoading && (
                <View style={ss.ocrLoading}>
                  <ActivityIndicator color={palette.teal[40]} />
                  <Text style={ss.ocrLoadingText}>{t('translate.reading')}</Text>
                </View>
              )}
              {!ocrLoading && !!ocrText && (
                <View style={{ marginTop: 12, gap: 10 }}>
                  <View style={ss.ocrCard}>
                    <Text style={ss.ocrCardLabel}>{t('translate.detected')} · 한국어</Text>
                    <Text style={ss.ocrDetected}>{ocrText}</Text>
                  </View>
                  <LinearGradient
                    colors={[palette.teal[95], '#fff']}
                    style={[ss.ocrCard, { borderColor: palette.teal[80] }]}>
                    <Text style={[ss.ocrCardLabel, { color: palette.teal[30] }]}>
                      {langLabel(tgt === 'ko' ? 'en' : tgt).toUpperCase()}
                    </Text>
                    <Text style={ss.ocrTranslated}>{ocrOut}</Text>
                  </LinearGradient>
                  {ocrMock && <FallbackBadge label="Sample OCR" />}
                </View>
              )}
            </View>
          )}

          {/* 상황별 문구 */}
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <Text style={ss.sectionLabel}>{t('translate.situationPhrases')}</Text>
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
                  <Text style={ss.scenarioTitle}>{t(`scenario.${s.k.toLowerCase()}`)}</Text>
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
                {picker === 'src' ? t('translate.from') : t('translate.to')}
              </Text>
              {picker === 'src' && (
                <Pressable
                  onPress={() => pickLang('auto')}
                  style={[ss.langOpt, src === 'auto' && ss.langOptOn]}>
                  <Text style={{ fontSize: 20 }}>🌐</Text>
                  <Text style={ss.langOptText}>{t('translate.autoDetect')}</Text>
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
      </View>
    </View>
  )
}

const ss = StyleSheet.create({
  gheader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 14 },
  gheaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gheaderTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  gheaderSub: { color: 'rgba(255,255,255,.85)', fontSize: 11.5, marginTop: 2 },
  gclose: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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

  // 음성 통역 전단계 카드
  voiceCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    backgroundColor: palette.zinc[50],
  },
  voiceMic: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: palette.teal[95],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  voiceTitle: { fontSize: 17, fontWeight: '800', color: palette.zinc[900] },
  voiceSub: {
    fontSize: 13,
    color: palette.zinc[500],
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  voiceStart: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.teal[40],
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 6,
  },
  voiceStartText: { color: '#fff', fontSize: 15, fontWeight: '700' },

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
  // 카메라 OCR
  ocrPreview: { width: '100%', height: 200, borderRadius: 16, backgroundColor: palette.zinc[100] },
  ocrHint: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.zinc[200],
    borderStyle: 'dashed',
    backgroundColor: '#fff',
  },
  ocrBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.teal[40],
    borderRadius: 14,
    paddingVertical: 13,
  },
  ocrBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  ocrBtnAlt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.teal[95],
    borderWidth: 1,
    borderColor: palette.teal[80],
    borderRadius: 14,
    paddingVertical: 13,
  },
  ocrBtnAltText: { color: palette.teal[30], fontSize: 14, fontWeight: '700' },
  ocrLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  ocrLoadingText: { fontSize: 13, color: palette.zinc[500], fontWeight: '600' },
  ocrCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.zinc[200],
    backgroundColor: '#fff',
    padding: 14,
  },
  ocrCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.zinc[400],
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  ocrDetected: { fontSize: 15, color: palette.zinc[800], lineHeight: 24 },
  ocrTranslated: { fontSize: 17, fontWeight: '700', color: palette.zinc[900], lineHeight: 26 },
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
