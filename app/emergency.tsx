import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { palette, shadows } from '@/theme/tokens'

const CALLS = [
  {
    num: '112',
    label: 'Police',
    sub: 'Crime · theft · lost',
    icon: 'local_police',
    tone: palette.blue[50],
  },
  {
    num: '119',
    label: 'Fire / Ambulance',
    sub: 'Medical · fire emergency',
    icon: 'emergency',
    tone: palette.error[50],
  },
  {
    num: '1330',
    label: 'Tourist Hotline',
    sub: '24/7 free interpreter (EN/JA/ZH)',
    icon: 'support_agent',
    tone: palette.teal[40],
  },
]

const PHRASES = [
  { en: 'I need help, please.', ko: '도와주세요.' },
  { en: 'Please call an ambulance.', ko: '구급차를 불러주세요.' },
  { en: "I'm lost. Where am I?", ko: '길을 잃었어요. 여기가 어디예요?' },
  { en: 'I lost my passport / wallet.', ko: '여권/지갑을 잃어버렸어요.' },
]

export default function EmergencyScreen() {
  return (
    <View style={ss.container}>
      <LinearGradient colors={['#EF4444', '#DC2626']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={ss.header}>
            <View style={ss.headerIcon}>
              <Icon name="sos" size={20} color="#fff" filled />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.headerTitle}>Emergency help</Text>
              <View style={ss.headerLoc}>
                <Icon name="location_on" size={12} color="#fff" filled />
                <Text style={ss.headerLocText}>Haeundae-gu, Busan · GPS shared on call</Text>
              </View>
            </View>
            <Pressable onPress={() => router.back()} style={ss.close}>
              <Icon name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View style={{ gap: 8 }}>
          {CALLS.map((c) => (
            <Pressable key={c.num} style={[ss.callCard, shadows.card]}>
              <View style={[ss.callIcon, { backgroundColor: c.tone }]}>
                <Icon name={c.icon} size={22} color="#fff" filled />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ss.callTitle}>
                  {c.num} · {c.label}
                </Text>
                <Text style={ss.callSub}>{c.sub}</Text>
              </View>
              <Icon name="call" size={20} color={c.tone} filled />
            </Pressable>
          ))}
        </View>

        <Text style={ss.sectionLabel}>SHOW THIS TO SOMEONE</Text>
        <View style={{ gap: 8 }}>
          {PHRASES.map((p) => (
            <View key={p.en} style={ss.phraseCard}>
              <Text style={ss.phraseKo}>{p.ko}</Text>
              <Text style={ss.phraseEn}>{p.en}</Text>
            </View>
          ))}
        </View>

        <Pressable style={({ pressed }) => [ss.hospitalBtn, { opacity: pressed ? 0.9 : 1 }]}>
          <Icon name="local_hospital" size={18} color="#fff" filled />
          <Text style={ss.hospitalText}>Find nearest hospital</Text>
        </Pressable>
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
    paddingBottom: 16,
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
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerLoc: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  headerLocText: { fontSize: 11, color: 'rgba(255,255,255,.92)' },
  close: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  callCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    borderRadius: 16,
    padding: 12,
    paddingHorizontal: 14,
  },
  callIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callTitle: { fontSize: 14, fontWeight: '800', color: palette.zinc[900] },
  callSub: { fontSize: 11, color: palette.zinc[500], marginTop: 1 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.zinc[500],
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 8,
  },
  phraseCard: {
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  phraseKo: { fontSize: 15, fontWeight: '700', color: palette.zinc[900] },
  phraseEn: { fontSize: 11, color: palette.zinc[500], marginTop: 2 },

  hospitalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    backgroundColor: palette.blue[50],
    borderRadius: 999,
    paddingVertical: 12,
  },
  hospitalText: { color: '#fff', fontWeight: '700', fontSize: 13 },
})
