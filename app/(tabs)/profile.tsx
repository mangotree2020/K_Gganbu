import { LinearGradient } from 'expo-linear-gradient'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { useSignOut } from '@/features/auth/queries'
import { useAuthStore } from '@/features/auth/store'
import { palette, shadows } from '@/theme/tokens'

const STATS = [
  { n: 3, l: 'Trips', e: '✈️' },
  { n: 12, l: 'Saved', e: '📍' },
  { n: 8, l: 'Reviews', e: '⭐' },
]

const ROWS: { label: string; emoji: string; badge?: string; detail?: string }[] = [
  { label: 'Customize home', emoji: '🧩', detail: 'Reorder' },
  { label: 'My itineraries', emoji: '🗓', badge: '3' },
  { label: 'Saved places', emoji: '📍', badge: '12' },
  { label: 'Saved coupons', emoji: '🎟', badge: '5' },
  { label: 'My reviews', emoji: '⭐', badge: '8' },
  { label: 'Phrasebook', emoji: '🗣' },
  { label: 'Allergy card', emoji: '🥜' },
  { label: 'Payment tips', emoji: '💳' },
  { label: 'Language', emoji: '🌐', detail: 'EN' },
  { label: 'Settings', emoji: '⚙️' },
]

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user)
  const { mutate: signOut, isPending } = useSignOut()

  return (
    <View style={ss.container}>
      {/* 헤더 */}
      <LinearGradient
        colors={['#38BDF8', '#0EA5E9', '#0284C7']}
        locations={[0, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={ss.header}>
        <SafeAreaView edges={['top']}>
          <View style={ss.profileRow}>
            <View style={ss.avatar}>
              <Text style={{ fontSize: 26 }}>👤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.name}>{user?.fullName ?? 'Traveler'}</Text>
              <Text style={ss.sub}>{user?.email ?? '🇯🇵 Japan · EN / 日本語'}</Text>
            </View>
            <View style={ss.planBox}>
              <Text style={ss.planLabel}>Plan</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Icon name="workspace_premium" size={11} color="#FDE68A" filled />
                <Text style={ss.planValue}>Premium</Text>
              </View>
            </View>
          </View>

          {/* 여행 진행 스트립 */}
          <View style={ss.tripStrip}>
            <Text style={{ fontSize: 22 }}>✈️</Text>
            <View style={{ flex: 1 }}>
              <Text style={ss.tripTitle}>Busan trip · day 2 of 5</Text>
              <Text style={ss.tripSub}>3 places visited · 2 coupons used · 12 phrases saved</Text>
            </View>
            <Icon name="chevron_right" size={20} color="#fff" />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}>
        {/* 통계 */}
        <View style={ss.statsRow}>
          {STATS.map((s) => (
            <View key={s.l} style={ss.statCard}>
              <Text style={{ fontSize: 18 }}>{s.e}</Text>
              <Text style={ss.statNum}>{s.n}</Text>
              <Text style={ss.statLabel}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* 프리미엄 */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <LinearGradient
            colors={['#1E1B4B', '#312E81', '#0EA5E9']}
            locations={[0, 0.6, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={ss.premium}>
            <Text style={{ fontSize: 30 }}>👑</Text>
            <View style={{ flex: 1 }}>
              <Text style={ss.premiumTitle}>K-Gganbu Premium · active</Text>
              <Text style={ss.premiumSub}>Offline maps · unlimited translate · priority AI</Text>
            </View>
            <View style={ss.premiumPrice}>
              <Text style={ss.premiumPriceText}>$4.99/mo</Text>
            </View>
          </LinearGradient>
        </View>

        {/* 메뉴 행 */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={ss.rowsCard}>
            {ROWS.map((r, i) => (
              <TouchableOpacity
                key={r.label}
                activeOpacity={0.6}
                style={[ss.row, i < ROWS.length - 1 && ss.rowBorder]}>
                <Text style={ss.rowEmoji}>{r.emoji}</Text>
                <Text style={ss.rowLabel}>{r.label}</Text>
                {r.badge && (
                  <View style={ss.rowBadge}>
                    <Text style={ss.rowBadgeText}>{r.badge}</Text>
                  </View>
                )}
                {r.detail && <Text style={ss.rowDetail}>{r.detail}</Text>}
                <Icon name="chevron_right" size={18} color={palette.zinc[500]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 로그아웃 */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <TouchableOpacity
            onPress={() => signOut()}
            disabled={isPending}
            activeOpacity={0.8}
            style={ss.logout}>
            <Icon name="block" size={18} color={palette.error[50]} />
            <Text style={ss.logoutText}>{isPending ? '로그아웃 중...' : '로그아웃'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  header: { paddingHorizontal: 16, paddingBottom: 18 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  sub: { fontSize: 12, color: 'rgba(255,255,255,.92)', marginTop: 2 },
  planBox: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,.22)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
  },
  planLabel: { fontSize: 9, color: 'rgba(255,255,255,.85)' },
  planValue: { fontSize: 11, fontWeight: '800', color: '#fff' },
  tripStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,.16)',
    borderRadius: 14,
    padding: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.18)',
  },
  tripTitle: { fontSize: 12, fontWeight: '700', color: '#fff' },
  tripSub: { fontSize: 10, color: 'rgba(255,255,255,.85)', marginTop: 1 },

  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statNum: { fontSize: 18, fontWeight: '800', color: palette.blue[50], marginTop: 4 },
  statLabel: { fontSize: 10, color: palette.zinc[500], marginTop: 1 },

  premium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    ...shadows.blue,
  },
  premiumTitle: { fontSize: 13.5, fontWeight: '800', color: '#fff' },
  premiumSub: { fontSize: 11, color: 'rgba(255,255,255,.86)', marginTop: 2 },
  premiumPrice: {
    backgroundColor: 'rgba(255,255,255,.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  premiumPriceText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  rowsCard: {
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    borderRadius: 18,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: palette.zinc[200] },
  rowEmoji: { fontSize: 20, width: 24, textAlign: 'center' },
  rowLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', color: palette.zinc[900] },
  rowBadge: {
    backgroundColor: palette.blue[90],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  rowBadgeText: { fontSize: 11, fontWeight: '700', color: palette.blue[30] },
  rowDetail: { fontSize: 11, color: palette.zinc[500], fontWeight: '600' },

  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  logoutText: { color: palette.error[50], fontWeight: '600', fontSize: 14 },
})
