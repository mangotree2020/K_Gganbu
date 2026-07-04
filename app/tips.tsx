import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'

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
      {/* 긴급 화면과 동일한 상단 디자인 — 그라데이션이 상태바 영역까지 채워 겹침 없음 */}
      <LinearGradient
        colors={['#7DD3FC', '#0EA5E9', '#075985']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={ss.gheader}>
            <View style={ss.gheaderIcon}>
              <Icon name="lightbulb" size={20} color="#fff" filled />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.gheaderTitle}>💡 {t('tips.title')}</Text>
              <Text style={ss.gheaderSub}>{t('tips.sub')}</Text>
            </View>
            <Pressable onPress={() => router.back()} style={ss.gclose}>
              <Icon name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
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
