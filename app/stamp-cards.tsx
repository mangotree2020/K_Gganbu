// 테마 스탬프 카드 (REQ-ST-2) — 카드별 도장 진행도, 완성 시 보너스 수령·보상 쿠폰 연결.
// 스탬프 적립 자체는 매장 QR 스캔(stamp-scan, REQ-ST-1)에서만 발생한다.
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { SheetHeader } from '@/components/SheetHeader'
import { useLoginPrompt } from '@/features/auth/loginPrompt'
import { useAuthStore } from '@/features/auth/store'
import { useClaimStampCard, useStampCards, type StampCard } from '@/features/stamp/queries'
import { useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

// 테마별 도장 이모지 — 카드 성격을 언어 없이 전달(§8 아이콘 중심)
const THEME_EMOJI: Record<string, string> = {
  food: '🍜',
  cafe: '☕',
  beauty: '💆',
  culture: '🏯',
  shopping: '🛍',
}
const themeEmoji = (theme: string) => THEME_EMOJI[theme] ?? '🔖'

export default function StampCardsScreen() {
  const t = useT()
  const user = useAuthStore((s) => s.user)
  const showLogin = useLoginPrompt((s) => s.show)
  const isGuest = !user || user.isGuest
  const { data: cards, isLoading } = useStampCards()
  const claim = useClaimStampCard()
  // 수령 결과 배너 — 카드별로 표시(성공 시 획득 포인트, 실패 시 사유)
  const [result, setResult] = useState<{
    cardId: string
    granted?: number
    error?: boolean
  } | null>(null)

  const onClaim = async (card: StampCard) => {
    if (isGuest) {
      showLogin('auth.gatePoints')
      return
    }
    try {
      const res = await claim.mutateAsync(card.id)
      setResult({ cardId: card.id, granted: res.granted ?? 0 })
    } catch {
      setResult({ cardId: card.id, error: true })
    }
  }

  return (
    <View style={ss.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <SheetHeader
          title={t('stampCard.title')}
          sub={t('stampCard.sub')}
          icon="approval"
          accent={palette.amber[50]}
          accentBg={palette.amber[90]}
        />

        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
          {/* 스캔 진입 — 카드 진행의 유일한 적립 수단 */}
          <Pressable
            onPress={() => router.push('/stamp-scan' as never)}
            style={[ss.scanBtn, shadows.card]}>
            <Text style={{ fontSize: 20 }}>📷</Text>
            <View style={{ flex: 1 }}>
              <Text style={ss.scanTitle}>{t('stamp.title')}</Text>
              <Text style={ss.dim}>{t('stamp.scanCta')}</Text>
            </View>
            <Icon name="chevron_right" size={18} color={palette.zinc[400]} />
          </Pressable>

          {isLoading ? (
            <ActivityIndicator color={palette.amber[50]} style={{ marginTop: 24 }} />
          ) : !cards?.length ? (
            // 빈 상태에서도 다음 행동 제시(UX_REVIEW §3 막다른 빈 화면 금지)
            <View style={ss.empty}>
              <Text style={{ fontSize: 40 }}>🔖</Text>
              <Text style={ss.emptyText}>{t('stampCard.empty')}</Text>
              <Text style={ss.emptySub}>{t('stampCard.emptySub')}</Text>
              <Pressable
                onPress={() => router.push('/(tabs)/map' as never)}
                style={[ss.claimBtn, { backgroundColor: palette.blue[50] }]}>
                <Text style={ss.claimText}>{t('stampCard.findStores')}</Text>
              </Pressable>
            </View>
          ) : (
            cards.map((c) => {
              const res = result?.cardId === c.id ? result : null
              return (
                <View key={c.id} style={[ss.card, shadows.card]}>
                  <View style={ss.cardHead}>
                    <Text style={{ fontSize: 22 }}>{themeEmoji(c.theme)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={ss.cardTitle}>{c.title}</Text>
                      {!!c.desc && <Text style={ss.dim}>{c.desc}</Text>}
                    </View>
                    <Text style={ss.bonus}>+{c.bonusPoints}P</Text>
                  </View>

                  {/* 도장 그리드 — 찍은 매장은 도장, 남은 매장은 빈 원 */}
                  <View style={ss.stampRow}>
                    {c.stores.map((s) => (
                      <View key={s.partnerId} style={{ alignItems: 'center', width: 68 }}>
                        <View style={[ss.stamp, s.stamped && ss.stampOn]}>
                          <Text style={{ fontSize: s.stamped ? 22 : 18 }}>
                            {s.stamped ? themeEmoji(c.theme) : '　'}
                          </Text>
                        </View>
                        <Text style={ss.storeName} numberOfLines={2}>
                          {s.name}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={ss.progressRow}>
                    <View style={ss.track}>
                      <View
                        style={[
                          ss.fill,
                          { width: `${Math.min(100, (c.visited / (c.need || 1)) * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={ss.progressText}>
                      {c.visited}/{c.need}
                    </Text>
                  </View>

                  {c.completed ? (
                    <View style={ss.doneRow}>
                      <Icon name="approval" size={16} color={palette.success[50]} />
                      <Text style={ss.doneText}>{t('stampCard.done')}</Text>
                      {!!c.rewardCouponId && (
                        <Pressable
                          onPress={() => router.push('/(tabs)/coupons' as never)}
                          style={ss.rewardLink}>
                          <Text style={ss.rewardLinkText}>{t('stampCard.reward')}</Text>
                          <Icon name="chevron_right" size={14} color={palette.coral[50]} />
                        </Pressable>
                      )}
                    </View>
                  ) : c.claimable ? (
                    <Pressable
                      onPress={() => onClaim(c)}
                      disabled={claim.isPending}
                      style={[ss.claimBtn, claim.isPending && { opacity: 0.6 }]}>
                      <Text style={ss.claimText}>
                        {t('stampCard.claim').replace('{n}', String(c.bonusPoints))}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={ss.remainText}>
                      {t('stampCard.remain').replace(
                        '{n}',
                        String(Math.max(0, c.need - c.visited)),
                      )}
                    </Text>
                  )}

                  {!!res && (
                    <Text style={[ss.resultText, res.error && { color: palette.error[50] }]}>
                      {res.error
                        ? t('stampCard.claimFailed')
                        : t('points.claimed').replace('{n}', String(res.granted ?? 0))}
                    </Text>
                  )}
                </View>
              )
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  dim: { fontSize: 12, color: palette.zinc[500] },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
  },
  scanTitle: { fontSize: 14, fontWeight: '800', color: palette.zinc[900] },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: palette.zinc[900] },
  bonus: { fontSize: 14, fontWeight: '800', color: palette.amber[50] },
  stampRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  stamp: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: palette.zinc[300],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.zinc[50],
  },
  stampOn: {
    borderStyle: 'solid',
    borderColor: palette.amber[50],
    backgroundColor: palette.amber[90],
  },
  storeName: { fontSize: 10, color: palette.zinc[600], textAlign: 'center', marginTop: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: palette.zinc[200] },
  fill: { height: 6, borderRadius: 3, backgroundColor: palette.amber[50] },
  progressText: { fontSize: 11, fontWeight: '800', color: palette.zinc[600] },
  claimBtn: {
    backgroundColor: palette.amber[50],
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
  },
  claimText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  remainText: { fontSize: 12, color: palette.zinc[500], textAlign: 'center' },
  doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  doneText: { fontSize: 12, fontWeight: '800', color: palette.zinc[700] },
  rewardLink: { flexDirection: 'row', alignItems: 'center', marginLeft: 6 },
  rewardLinkText: { fontSize: 12, fontWeight: '800', color: palette.coral[50] },
  resultText: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.amber[50],
    textAlign: 'center',
  },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyText: { fontSize: 15, fontWeight: '800', color: palette.zinc[700] },
  emptySub: { fontSize: 12, color: palette.zinc[500], textAlign: 'center', marginBottom: 6 },
})
