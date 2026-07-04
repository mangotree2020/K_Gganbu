// 내 리뷰 (PLANNING Phase 3 "리뷰") — 내가 평가한 장소 목록.
import { useQuery } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { PlaceThumb } from '@/components/PlaceThumb'
import { getMyReviews } from '@/features/review/services'
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
  const { data } = useQuery({ queryKey: ['my-reviews'], queryFn: getMyReviews })
  const reviews = data ?? []

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
        {reviews.length === 0 ? (
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
