import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Icon } from '@/components/brand'
import { SheetHeader } from '@/components/SheetHeader'
import { useT } from '@/lib/i18n'
import { palette } from '@/theme/tokens'

// ko(식당 직원에게 보여줄 한국어) 고정 + key(사용자 언어 라벨)
const ALLERGENS = [
  { id: 'peanut', emoji: '🥜', key: 'allergen.peanut', ko: '땅콩' },
  { id: 'shellfish', emoji: '🦐', key: 'allergen.shellfish', ko: '갑각류 (새우, 게)' },
  { id: 'milk', emoji: '🥛', key: 'allergen.milk', ko: '유제품' },
  { id: 'egg', emoji: '🥚', key: 'allergen.egg', ko: '달걀' },
  { id: 'wheat', emoji: '🌾', key: 'allergen.wheat', ko: '밀 (글루텐)' },
  { id: 'soy', emoji: '🫘', key: 'allergen.soy', ko: '콩' },
  { id: 'fish', emoji: '🐟', key: 'allergen.fish', ko: '생선' },
  { id: 'sesame', emoji: '🌿', key: 'allergen.sesame', ko: '참깨' },
]

export default function AllergyScreen() {
  const t = useT()
  const [sel, setSel] = useState<Record<string, boolean>>({ peanut: true, shellfish: true })
  const toggle = (id: string) => setSel((s) => ({ ...s, [id]: !s[id] }))
  const active = ALLERGENS.filter((a) => sel[a.id])

  return (
    <View style={ss.container}>
      <View style={{ paddingTop: 8 }}>
        <SheetHeader
          title={`🥜 ${t('profile.allergy')}`}
          sub={t('allergy.sub')}
          accent={palette.coral[50]}
          accentBg={palette.coral[95]}
          icon="medical_services"
        />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}>
        {/* 카드 */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={ss.card}>
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <Text style={ss.cardTitle}>⚠️ 알레르기 안내 / Allergy</Text>
              <Text style={ss.cardSub}>아래 재료를 절대 사용하지 말아주세요</Text>
            </View>
            <View style={{ gap: 8 }}>
              {active.length === 0 ? (
                <Text style={ss.empty}>{t('allergy.selectBelow')}</Text>
              ) : (
                active.map((a) => (
                  <View key={a.id} style={ss.activeRow}>
                    <Text style={{ fontSize: 26 }}>{a.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={ss.activeKo}>{a.ko}</Text>
                      <Text style={ss.activeEn}>{t(a.key)}</Text>
                    </View>
                    <Icon name="block" size={18} color={palette.error[50]} filled />
                  </View>
                ))
              )}
            </View>
            <View style={ss.note}>
              <Text style={ss.noteKo}>
                저는 위 재료에 알레르기가 있습니다. 가능한 다른 메뉴를 추천해 주세요.
              </Text>
              <Text style={ss.noteEn}>{t('allergy.noteEn')}</Text>
            </View>
          </View>
        </View>

        {/* 선택기 */}
        <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
          <Text style={ss.pickerLabel}>{t('allergy.myAllergies')}</Text>
          <View style={ss.grid}>
            {ALLERGENS.map((a) => {
              const on = !!sel[a.id]
              return (
                <Pressable
                  key={a.id}
                  onPress={() => toggle(a.id)}
                  style={[ss.pickItem, on ? ss.pickOn : ss.pickOff]}>
                  <Text style={{ fontSize: 18 }}>{a.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[ss.pickEn, { color: on ? palette.error[50] : palette.zinc[900] }]}>
                      {t(a.key)}
                    </Text>
                    <Text style={ss.pickKo}>{a.ko}</Text>
                  </View>
                  {on && <Icon name="check_circle" size={16} color={palette.error[50]} filled />}
                </Pressable>
              )
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: palette.error[50],
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: palette.error[50], letterSpacing: 0.3 },
  cardSub: { fontSize: 10, color: palette.zinc[500], marginTop: 2 },
  empty: { textAlign: 'center', fontSize: 12, color: palette.zinc[500], paddingVertical: 12 },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 10,
    paddingHorizontal: 12,
    borderWidth: 0.5,
    borderColor: '#FCA5A5',
  },
  activeKo: { fontSize: 16, fontWeight: '800', color: '#7F1D1D', letterSpacing: -0.2 },
  activeEn: { fontSize: 11, color: palette.zinc[500], marginTop: 2 },
  note: { marginTop: 12, padding: 10, backgroundColor: palette.zinc[50], borderRadius: 10 },
  noteKo: { fontSize: 11, color: palette.zinc[700], lineHeight: 17, textAlign: 'center' },
  noteEn: {
    fontSize: 10,
    color: palette.zinc[500],
    marginTop: 4,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  pickerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.zinc[500],
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pickItem: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 8,
    paddingHorizontal: 10,
  },
  pickOn: { borderWidth: 1.5, borderColor: palette.error[50], backgroundColor: '#FEF2F2' },
  pickOff: { borderWidth: 0.5, borderColor: palette.zinc[200], backgroundColor: '#fff' },
  pickEn: { fontSize: 12, fontWeight: '700' },
  pickKo: { fontSize: 9.5, color: palette.zinc[500] },
})
