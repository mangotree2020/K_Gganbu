import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { useCurrentLocation } from '@/hooks/useCurrentLocation'
import { useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

const CALLS = [
  {
    num: '112',
    labelKey: 'emergency.police',
    subKey: 'emergency.policeSub',
    icon: 'local_police',
    tone: palette.blue[50],
  },
  {
    num: '119',
    labelKey: 'emergency.fire',
    subKey: 'emergency.fireSub',
    icon: 'emergency',
    tone: palette.error[50],
  },
  {
    num: '1330',
    labelKey: 'emergency.hotline',
    subKey: 'emergency.hotlineSub',
    icon: 'support_agent',
    tone: palette.teal[40],
  },
]

// ko(상대에게 보여줄 한국어) 고정 + key(사용자 언어 설명)
const PHRASES = [
  { ko: '도와주세요.', key: 'ephrase.help' },
  { ko: '구급차를 불러주세요.', key: 'ephrase.ambulance' },
  { ko: '길을 잃었어요. 여기가 어디예요?', key: 'ephrase.lost' },
  { ko: '여권/지갑을 잃어버렸어요.', key: 'ephrase.lostItem' },
]

export default function EmergencyScreen() {
  const t = useT()
  const { coords, loading: locLoading } = useCurrentLocation()
  const hasGps = !locLoading && !!coords?.latitude

  // 전화 연결 (긴급 번호)
  const call = (num: string) => Linking.openURL(`tel:${num}`).catch(() => {})

  // 현재 위치 공유 (좌표 + 구글맵 링크) — 일행/구조대에게 전달
  const shareLocation = async () => {
    if (!hasGps) return
    const { latitude, longitude } = coords
    const link = `https://maps.google.com/?q=${latitude},${longitude}`
    try {
      await Share.share({
        message: `My current location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}\n${link}`,
      })
    } catch {
      // 공유 취소 — 무시
    }
  }

  // 가까운 병원 찾기 — 현재 위치 기준 외부 지도 검색
  const findHospital = () => {
    const q = hasGps
      ? `https://www.google.com/maps/search/hospital/@${coords.latitude},${coords.longitude},15z`
      : `https://www.google.com/maps/search/?api=1&query=hospital+Busan`
    Linking.openURL(q).catch(() => {})
  }

  return (
    <View style={ss.container}>
      <LinearGradient
        colors={['#FB7185', '#EF4444', '#B91C1C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={ss.header}>
            <View style={ss.headerIcon}>
              <Icon name="sos" size={20} color="#fff" filled />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.headerTitle}>{t('emergency.title')}</Text>
              <View style={ss.headerLoc}>
                <Icon name="location_on" size={12} color="#fff" filled />
                <Text style={ss.headerLocText}>
                  {hasGps
                    ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)} · ${t('emergency.gpsReady')}`
                    : t('emergency.locating')}
                </Text>
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
            <Pressable key={c.num} style={[ss.callCard, shadows.card]} onPress={() => call(c.num)}>
              <View style={[ss.callIcon, { backgroundColor: c.tone }]}>
                <Icon name={c.icon} size={22} color="#fff" filled />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ss.callTitle}>
                  {c.num} · {t(c.labelKey)}
                </Text>
                <Text style={ss.callSub}>{t(c.subKey)}</Text>
              </View>
              <Icon name="call" size={20} color={c.tone} filled />
            </Pressable>
          ))}
        </View>

        <Text style={ss.sectionLabel}>{t('emergency.showToSomeone')}</Text>
        <View style={{ gap: 8 }}>
          {PHRASES.map((p) => (
            <View key={p.key} style={ss.phraseCard}>
              <Text style={ss.phraseKo}>{p.ko}</Text>
              <Text style={ss.phraseEn}>{t(p.key)}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={shareLocation}
          disabled={!hasGps}
          style={({ pressed }) => [ss.shareBtn, { opacity: pressed || !hasGps ? 0.6 : 1 }]}>
          <Icon name="share" size={18} color={palette.zinc[900]} />
          <Text style={ss.shareText}>
            {hasGps ? t('emergency.shareLocation') : t('emergency.locating')}
          </Text>
        </Pressable>

        <Pressable
          onPress={findHospital}
          style={({ pressed }) => [ss.hospitalBtn, { opacity: pressed ? 0.9 : 1 }]}>
          <Icon name="local_hospital" size={18} color="#fff" filled />
          <Text style={ss.hospitalText}>{t('emergency.findHospital')}</Text>
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

  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    backgroundColor: palette.zinc[100],
    borderWidth: 0.5,
    borderColor: palette.zinc[300],
    borderRadius: 999,
    paddingVertical: 12,
  },
  shareText: { color: palette.zinc[900], fontWeight: '700', fontSize: 13 },
  hospitalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: palette.blue[50],
    borderRadius: 999,
    paddingVertical: 12,
  },
  hospitalText: { color: '#fff', fontWeight: '700', fontSize: 13 },
})
