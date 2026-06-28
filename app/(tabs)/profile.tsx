import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { ProfileAvatar } from '@/features/profile/Avatar'
import { useProfileStore } from '@/features/profile/store'
import { zodiacImage, zodiacOf, zodiacYearLabel, ZODIAC_EMOJI } from '@/features/profile/zodiac'
import { useSignOut } from '@/features/auth/queries'
import { enablePush } from '@/features/notifications/services'
import { usePushStore } from '@/features/notifications/store'
import { useUserCoupons } from '@/features/coupon/queries'
import { useFavorites } from '@/features/favorites/queries'
import { usePassport } from '@/features/passport/queries'
import { useAuthStore } from '@/features/auth/store'
import { APP_LANGS, useLocaleStore, useT, type AppLang } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

const STATS = [
  { n: 3, l: 'Trips', e: '✈️' },
  { n: 12, l: 'Saved', e: '📍' },
  { n: 8, l: 'Reviews', e: '⭐' },
]

type Row = { id: string; label: string; emoji: string; badge?: string; detail?: string }
const ROWS: Row[] = [
  { id: 'customize', label: 'Customize home', emoji: '🧩', detail: 'Reorder' },
  { id: 'itineraries', label: 'My itineraries', emoji: '🗓', badge: '3' },
  { id: 'tickets', label: 'Tickets', emoji: '🎫' },
  { id: 'saved-places', label: 'Saved places', emoji: '📍', badge: '12' },
  { id: 'saved-coupons', label: 'Saved coupons', emoji: '🎟', badge: '5' },
  { id: 'reviews', label: 'My reviews', emoji: '⭐', badge: '8' },
  { id: 'phrasebook', label: 'Phrasebook', emoji: '🗣' },
  { id: 'allergy', label: 'Allergy card', emoji: '🥜' },
  { id: 'payment', label: 'Payment tips', emoji: '💳' },
  { id: 'notifications', label: 'Notifications', emoji: '🔔' },
  { id: 'language', label: 'Language', emoji: '🌐' },
  { id: 'settings', label: 'Settings', emoji: '⚙️' },
]

// 행 id → i18n 키
const ROW_KEY: Record<string, string> = {
  customize: 'profile.customize',
  itineraries: 'profile.itineraries',
  tickets: 'ticket.title',
  'saved-places': 'profile.savedPlaces',
  'saved-coupons': 'profile.savedCoupons',
  reviews: 'profile.reviews',
  phrasebook: 'profile.phrasebook',
  allergy: 'profile.allergy',
  payment: 'profile.payment',
  notifications: 'profile.notifications',
  language: 'common.language',
  settings: 'common.settings',
}

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user)
  const { mutate: signOut, isPending } = useSignOut()
  const t = useT()
  const lang = useLocaleStore((s) => s.lang)
  const setLang = useLocaleStore((s) => s.setLang)
  const [langOpen, setLangOpen] = useState(false)
  const [charOpen, setCharOpen] = useState(false)
  // 프로필(로컬) — 아바타·성별·출생연도
  const profile = useProfileStore()
  const currentLang = APP_LANGS.find((l) => l.code === lang) ?? APP_LANGS[0]
  const { data: favorites } = useFavorites()
  const { data: savedCoupons } = useUserCoupons()
  const { data: passport } = usePassport()
  const pushEnabled = usePushStore((s) => s.enabled)
  const setPushEnabled = usePushStore((s) => s.setEnabled)

  // 알림 opt-in 토글 — 켤 때만 권한·토큰 등록(just-in-time)
  const toggleNotifications = async () => {
    if (pushEnabled) {
      setPushEnabled(false)
      return
    }
    const ok = await enablePush()
    setPushEnabled(ok)
  }

  // 저장 항목 개수는 실데이터로 표시
  const badgeFor = (r: Row) => {
    if (r.id === 'saved-places') return favorites?.length ? String(favorites.length) : undefined
    if (r.id === 'saved-coupons')
      return savedCoupons?.length ? String(savedCoupons.length) : undefined
    return r.badge
  }

  // 행별 라벨/디테일/동작 (언어 행은 i18n + 현재 언어 표시)
  const labelFor = (r: Row) => (ROW_KEY[r.id] ? t(ROW_KEY[r.id]) : r.label)
  const detailFor = (r: Row) => {
    if (r.id === 'language') return currentLang.label
    if (r.id === 'notifications') return pushEnabled ? t('common.on') : t('common.off')
    return r.detail
  }
  const onRowPress = (r: Row) => {
    if (r.id === 'language') setLangOpen(true)
    else if (r.id === 'notifications') toggleNotifications()
    else if (r.id === 'itineraries') router.push('/itinerary' as never)
    else if (r.id === 'tickets') router.push('/(tabs)/coupons?seg=tickets' as never)
    else if (r.id === 'reviews') router.push('/reviews' as never)
    else if (r.id === 'saved-places') router.push('/favorites')
    else if (r.id === 'saved-coupons') router.push('/saved-coupons')
    else if (r.id === 'allergy') router.push('/allergy')
    else if (r.id === 'phrasebook') router.push('/phrases')
  }

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
            <Pressable onPress={() => setCharOpen(true)} hitSlop={6}>
              <ProfileAvatar size={56} style={ss.avatar} />
              <View style={ss.avatarEdit}>
                <Icon name="auto_awesome" size={11} color="#fff" />
              </View>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={ss.name}>{profile.displayName || user?.fullName || 'Traveler'}</Text>
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

        {/* 여권 스캔 → 면세 (Passport & Tax-Free) — 등록 시 상태 카드, 미등록 시 CTA. → /passport (#26) */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/passport')}>
            <LinearGradient
              colors={['#1E3A5F', '#0EA5E9', '#0D9488']}
              locations={[0, 0.7, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={ss.passportCard}>
              <View style={ss.passportTop}>
                <View style={ss.passportIcon}>
                  <Text style={{ fontSize: 24 }}>🛂</Text>
                </View>
                {passport ? (
                  <View style={{ flex: 1 }}>
                    <Text style={ss.passportTitle}>
                      {passport.surname}
                      {passport.givenName ? `, ${passport.givenName}` : ''}
                    </Text>
                    <Text style={ss.passportSub}>
                      {passport.nationality ?? '—'} · {t('passport.taxFreeOn')}
                    </Text>
                  </View>
                ) : (
                  <View style={{ flex: 1 }}>
                    <Text style={ss.passportTitle}>{t('profile.passportTitle')}</Text>
                    <Text style={ss.passportSub}>{t('profile.passportSub')}</Text>
                  </View>
                )}
                <Icon name="chevron_right" size={20} color="rgba(255,255,255,.8)" />
              </View>
              <View style={ss.passportChips}>
                {(passport
                  ? [`🛂 Tax-Free ON`, `✈️ ${t('profile.passportChip1')}`]
                  : [
                      `✈️ ${t('profile.passportChip1')}`,
                      `🧾 ${t('profile.passportChip2')}`,
                      `🔒 ${t('profile.passportChip3')}`,
                    ]
                ).map((c) => (
                  <View key={c} style={ss.passportChip}>
                    <Text style={ss.passportChipText}>{c}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </TouchableOpacity>
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
            {ROWS.map((r, i) => {
              const detail = detailFor(r)
              return (
                <TouchableOpacity
                  key={r.id}
                  activeOpacity={0.6}
                  onPress={() => onRowPress(r)}
                  style={[ss.row, i < ROWS.length - 1 && ss.rowBorder]}>
                  <Text style={ss.rowEmoji}>{r.emoji}</Text>
                  <Text style={ss.rowLabel}>{labelFor(r)}</Text>
                  {badgeFor(r) && (
                    <View style={ss.rowBadge}>
                      <Text style={ss.rowBadgeText}>{badgeFor(r)}</Text>
                    </View>
                  )}
                  {detail && <Text style={ss.rowDetail}>{detail}</Text>}
                  <Icon name="chevron_right" size={18} color={palette.zinc[500]} />
                </TouchableOpacity>
              )
            })}
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
            <Text style={ss.logoutText}>{isPending ? '...' : t('common.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 언어 선택 모달 */}
      <Modal
        visible={langOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setLangOpen(false)}>
        <Pressable style={ss.langBackdrop} onPress={() => setLangOpen(false)}>
          <Pressable style={ss.langSheet} onPress={(e) => e.stopPropagation()}>
            <View style={ss.langHandle} />
            <Text style={ss.langTitle}>{t('common.language')}</Text>
            {APP_LANGS.map((l) => {
              const active = l.code === lang
              return (
                <TouchableOpacity
                  key={l.code}
                  activeOpacity={0.7}
                  onPress={() => {
                    setLang(l.code as AppLang)
                    setLangOpen(false)
                  }}
                  style={[ss.langRow, active && ss.langRowActive]}>
                  <Text style={{ fontSize: 22 }}>{l.flag}</Text>
                  <Text style={[ss.langLabel, active && ss.langLabelActive]}>{l.label}</Text>
                  {active && <Icon name="check_circle" size={20} color={palette.blue[50]} filled />}
                </TouchableOpacity>
              )
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* 캐릭터 애니메이션 오버레이 — My 아바타 탭 시 12지신 캐릭터 등장 (현재 정지 이미지 + 모션, 추후 애니메이션 에셋) */}
      <CharacterOverlay
        visible={charOpen}
        onClose={() => setCharOpen(false)}
        onEdit={() => {
          setCharOpen(false)
          router.push('/profile-edit')
        }}
      />
    </View>
  )
}

// 캐릭터 오버레이 — 12지신 캐릭터를 크게 띄우고 등장/플로팅 모션 재생.
// 사진 등록 시 사진을, 출생연도만 있으면 띠 캐릭터를, 둘 다 없으면 안내를 보여준다.
function CharacterOverlay({
  visible,
  onClose,
  onEdit,
}: {
  visible: boolean
  onClose: () => void
  onEdit: () => void
}) {
  const t = useT()
  const lang = useLocaleStore((s) => s.lang)
  const { photoUri, gender, birthYear } = useProfileStore()
  const [enter] = useState(() => new Animated.Value(0))
  const [float] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (!visible) {
      enter.setValue(0)
      return
    }
    Animated.spring(enter, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start()
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [visible, enter, float])

  const animal = birthYear ? zodiacOf(birthYear) : null
  const source = photoUri ? { uri: photoUri } : animal ? zodiacImage(gender, birthYear!) : null

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -14] })
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] })

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={ss.charBackdrop} onPress={onClose}>
        <Animated.View
          style={[ss.charStage, { opacity: enter, transform: [{ translateY }, { scale }] }]}>
          {source ? (
            <Image source={source} style={ss.charImg} resizeMode="contain" />
          ) : (
            <View style={ss.charEmpty}>
              <Text style={{ fontSize: 64 }}>🧧</Text>
            </View>
          )}
        </Animated.View>

        {animal && !photoUri && (
          <View style={ss.charLabel}>
            <Text style={ss.charLabelText}>
              {ZODIAC_EMOJI[animal]} {zodiacYearLabel(lang, animal)}
            </Text>
          </View>
        )}
        {!source && <Text style={ss.charHint}>{t('profile.zodiacEmpty')}</Text>}

        <Pressable style={ss.charEdit} onPress={onEdit}>
          <Icon name="settings" size={16} color={palette.blue[40]} />
          <Text style={ss.charEditText}>{t('profile.editProfile')}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  header: { paddingHorizontal: 16, paddingBottom: 18 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8 },
  avatar: {
    backgroundColor: 'rgba(255,255,255,.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,.42)',
  },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.coral[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
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

  // 여권 스캔 → 면세 카드
  passportCard: { borderRadius: 18, overflow: 'hidden', ...shadows.blue },
  passportTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    paddingBottom: 13,
  },
  passportIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passportTitle: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  passportSub: { fontSize: 11, color: 'rgba(255,255,255,.9)', marginTop: 2 },
  passportChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 13,
  },
  passportChip: {
    backgroundColor: 'rgba(255,255,255,.18)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  passportChipText: { fontSize: 10, fontWeight: '700', color: '#fff' },

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

  // 언어 선택 모달
  langBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
  langSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 32,
  },
  langHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: palette.zinc[300],
    marginBottom: 14,
  },
  langTitle: { fontSize: 16, fontWeight: '800', color: palette.zinc[900], marginBottom: 8 },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  langRowActive: { backgroundColor: palette.blue[90] },
  langLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: palette.zinc[800] },
  langLabelActive: { color: palette.blue[30], fontWeight: '800' },
  // 캐릭터 오버레이
  charBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9,9,11,.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  // 캐릭터 일러스트는 배경(크림)이 박혀 있어 어두운 백드롭에 사각으로 뜬다 →
  // 같은 톤의 둥근 카드로 감싸 자연스럽게 보이게 한다.
  charStage: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF3E3',
    borderRadius: 32,
    overflow: 'hidden',
    ...shadows.pop,
  },
  charImg: { width: 288, height: 288 },
  charEmpty: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  charLabel: {
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,.14)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  charLabelText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  charHint: {
    marginTop: 16,
    color: 'rgba(255,255,255,.8)',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
  },
  charEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 26,
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
  },
  charEditText: { color: palette.blue[40], fontWeight: '800', fontSize: 14 },
})
