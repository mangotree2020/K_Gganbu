import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { SheetHeader } from '@/components/SheetHeader'
import { palette } from '@/theme/tokens'

const TONES: Record<string, { bg: string; c: string }> = {
  blue: { bg: palette.blue[95], c: palette.blue[30] },
  coral: { bg: palette.coral[95], c: palette.coral[30] },
  teal: { bg: palette.teal[95], c: palette.teal[30] },
  amber: { bg: '#FEF3C7', c: '#92400E' },
  error: { bg: '#FEE2E2', c: palette.error[50] },
}

const TIPS = [
  {
    emoji: '💳',
    title: 'Cards work almost everywhere',
    body: 'Visa/Mastercard accepted at 95% of shops. Tap-to-pay common. AMEX rare — bring backup.',
    tone: 'blue',
  },
  {
    emoji: '🚇',
    title: 'T-money for transit',
    body: 'Buy at any convenience store (₩4,000 + topup). Works on subway, bus, taxi. Bus drivers don’t take cash.',
    tone: 'teal',
  },
  {
    emoji: '🚫',
    title: 'No tipping culture',
    body: 'Tipping is not expected and can feel awkward. The bill is the final price; service charge already included at fancy restaurants.',
    tone: 'coral',
  },
  {
    emoji: '✈️',
    title: 'Tax-free refund at airport',
    body: 'Spend ₩15,000+ at TAX FREE shops, keep receipts. Refund desk: Incheon T1 4F, Gimhae 3F International.',
    tone: 'amber',
  },
  {
    emoji: '📞',
    title: 'Tourist hotline 1330',
    body: '24/7 free interpreter in EN/JA/ZH/RU/TH/VI. Police: 112. Ambulance/fire: 119.',
    tone: 'error',
  },
  {
    emoji: '🍻',
    title: 'Drinking is social',
    body: 'Two hands when receiving / pouring for elders. 건배 (geonbae) = cheers. Bars often close at 1–2 AM weekdays.',
    tone: 'blue',
  },
  {
    emoji: '🚖',
    title: 'Taxi via Kakao T',
    body: 'Show destination in 한글 on map. Default taxis are cheap. “International Taxi” fixes price for long routes.',
    tone: 'teal',
  },
  {
    emoji: '🛎',
    title: 'Show, don’t say',
    body: 'Address & restaurant names on screen beat pronouncing. Use the “show staff” button to enlarge Korean text.',
    tone: 'coral',
  },
]

export default function TipsScreen() {
  return (
    <View style={ss.container}>
      <View style={{ paddingTop: 8 }}>
        <SheetHeader
          title="💡 Payment & culture tips"
          sub="The 30-second crash course for Korea"
          accent={palette.blue[50]}
          accentBg={palette.blue[95]}
          icon="lightbulb"
        />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10 }}>
        {TIPS.map((t) => {
          const tone = TONES[t.tone]
          return (
            <View key={t.title} style={[ss.card, { backgroundColor: tone.bg }]}>
              <Text style={ss.emoji}>{t.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[ss.title, { color: tone.c }]}>{t.title}</Text>
                <Text style={ss.body}>{t.body}</Text>
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
