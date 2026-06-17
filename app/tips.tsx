import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { SheetHeader } from '@/components/SheetHeader'
import { useT } from '@/lib/i18n'
import { palette } from '@/theme/tokens'

const TONES: Record<string, { bg: string; c: string }> = {
  blue: { bg: palette.blue[95], c: palette.blue[30] },
  coral: { bg: palette.coral[95], c: palette.coral[30] },
  teal: { bg: palette.teal[95], c: palette.teal[30] },
  amber: { bg: '#FEF3C7', c: '#92400E' },
  error: { bg: '#FEE2E2', c: palette.error[50] },
}

const TIPS = [
  { emoji: '💳', tk: 'tips.t1', bk: 'tips.b1', tone: 'blue' },
  { emoji: '🚇', tk: 'tips.t2', bk: 'tips.b2', tone: 'teal' },
  { emoji: '🚫', tk: 'tips.t3', bk: 'tips.b3', tone: 'coral' },
  { emoji: '✈️', tk: 'tips.t4', bk: 'tips.b4', tone: 'amber' },
  { emoji: '📞', tk: 'tips.t5', bk: 'tips.b5', tone: 'error' },
  { emoji: '🍻', tk: 'tips.t6', bk: 'tips.b6', tone: 'blue' },
  { emoji: '🚖', tk: 'tips.t7', bk: 'tips.b7', tone: 'teal' },
  { emoji: '🛎', tk: 'tips.t8', bk: 'tips.b8', tone: 'coral' },
]

export default function TipsScreen() {
  const t = useT()
  return (
    <View style={ss.container}>
      <View style={{ paddingTop: 8 }}>
        <SheetHeader
          title={`💡 ${t('tips.title')}`}
          sub={t('tips.sub')}
          accent={palette.blue[50]}
          accentBg={palette.blue[95]}
          icon="lightbulb"
        />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10 }}>
        {TIPS.map((tip) => {
          const tone = TONES[tip.tone]
          return (
            <View key={tip.tk} style={[ss.card, { backgroundColor: tone.bg }]}>
              <Text style={ss.emoji}>{tip.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[ss.title, { color: tone.c }]}>{t(tip.tk)}</Text>
                <Text style={ss.body}>{t(tip.bk)}</Text>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  card: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 12,
    paddingHorizontal: 14,
  },
  emoji: { fontSize: 26 },
  title: { fontSize: 13.5, fontWeight: '800', letterSpacing: -0.1 },
  body: { fontSize: 12, color: palette.zinc[700], marginTop: 4, lineHeight: 18 },
})
