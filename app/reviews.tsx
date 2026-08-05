// 내 리뷰 (PLANNING Phase 3 "리뷰") — 내가 평가한 장소 목록.
import { useQuery } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { PlaceThumb } from '@/components/PlaceThumb'
import { ReviewSheet, type ReviewTargetPlace } from '@/features/review/ReviewSheet'
import { getMyReviews } from '@/features/review/services'
import { markVisitReviewed, readPendingVisits } from '@/features/review/visits'
import { useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

function Stars({ n }: { n: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          name="star"
          size={13}
          color={i <= n ? palette.amber[50] : palette.zinc[300]}
          filled
        />
      ))}
    </View>
  )
}

export default function ReviewsScreen() {
  const t = useT()
  const { data, refetch } = useQuery({ queryKey: ['my-reviews'], queryFn: getMyReviews })
  const reviews = data ?? []
  // 후기를 기다리는 방문 — 다녀왔지만 아직 안 남긴 곳(로컬 방문 기록). 작성하면 목록에서 빠진다.
  const [pending, setPending] = useState(() => readPendingVisits())
  const [reviewFor, setReviewFor] = useState<ReviewTargetPlace | null>(null)
  const onSaved = (placeKey: string) => {
    markVisitReviewed(placeKey)
    setPending(readPendingVisits())
    void refetch()
  }

  return (
    <View style={ss.container}>
      {/* 헤더 — 여행자 후기 색(Amber) 그라데이션이 상태바 영역까지(퀵 타일 상세와 동일 스타일) */}
      <LinearGradient
        colors={['#FDE68A', '#F59E0B', '#B45309']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={ss.gheader}>
            <View style={ss.gheaderIcon}>
              <Icon name="star" size={20} color="#fff" filled />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.gheaderTitle}>{t('review.title')}</Text>
              <Text style={ss.gheaderSub}>{t('review.sub')}</Text>
            </View>
            <Pressable onPress={() => router.back()} style={ss.gclose}>
              <Icon name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 10 }}>
        {/* 후기 대기 — 방문 직후를 놓쳤어도 여기서 마저 남길 수 있다 */}
        {pending.length > 0 && (
          <>
            <Text style={ss.section}>{t('review.pendingTitle')}</Text>
            {pending.map((v) => (
              <Pressable
                key={v.placeKey}
                style={[ss.pendingCard, shadows.card]}
                onPress={() =>
                  // 쿠폰 방문은 발급 id를 그대로 넘겨야 서버 중복 제약이 걸린다
                  setReviewFor({
                    placeKey: v.placeKey,
                    name: v.name,
                    cat: v.cat,
                    refId: v.refId ?? null,
                  })
                }>
                <View style={ss.thumb}>
                  <PlaceThumb category={v.cat} height={52} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.place} numberOfLines={1}>
                    {v.name}
                  </Text>
                  <Text style={ss.date}>{new Date(v.at).toISOString().slice(0, 10)}</Text>
                </View>
                <View style={ss.writeChip}>
                  <Icon name="star" size={13} color={palette.amber[50]} filled />
                  <Text style={ss.writeChipText}>{t('review.write')}</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {reviews.length === 0 && pending.length === 0 ? (
          <Text style={ss.empty}>{t('review.empty')}</Text>
        ) : (
          reviews.map((r) => (
            <View key={r.id} style={[ss.card, shadows.card]}>
              <View style={ss.thumb}>
                <PlaceThumb category={r.cat} height={52} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={ss.cardTop}>
                  <Text style={ss.place}>{r.place}</Text>
                  <Text style={ss.date}>{r.date}</Text>
                </View>
                <Stars n={r.rating} />
                <Text style={ss.text}>{r.text}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <ReviewSheet
        visible={!!reviewFor}
        place={reviewFor}
        onClose={() => setReviewFor(null)}
        onSaved={onSaved}
      />
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
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.zinc[200],
  },
  title: { fontSize: 19, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.3 },
  sub: { fontSize: 12, color: palette.zinc[500], marginTop: 2 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { fontSize: 13, fontWeight: '800', color: palette.zinc[600], marginTop: 2 },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: palette.amber[90],
  },
  writeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  writeChipText: { fontSize: 11, fontWeight: '800', color: palette.zinc[700] },
  empty: { fontSize: 13, color: palette.zinc[400], textAlign: 'center', marginTop: 48 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  thumb: { width: 52, height: 52, borderRadius: 13, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  place: { fontSize: 14, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.1 },
  date: { fontSize: 10, color: palette.zinc[400] },
  text: { fontSize: 12, color: palette.zinc[600], lineHeight: 18, marginTop: 5 },
})
