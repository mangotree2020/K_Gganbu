// 장소 리뷰 섹션 (지도 시트·장소 상세 공용) — 레이아웃 단일화
// 구성: 제목(★평점·건수) → AI 요약(서버 캐시) → 출처 카드 2종(N 로컬/G 여행자,
// 탭 = 출처 필터, 외부지도 링크) → 개별 리뷰(국기 탭 번역·원문 토글).
// 지도 시트에서 쓰던 구현을 그대로 추출 — 두 화면이 항상 동일하게 보이도록 여기서만 수정한다.
import { useEffect, useMemo, useState } from 'react'
import { Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native'

import { Icon } from '@/components/brand'
import { FallbackBadge } from '@/components/FallbackBadge'
import { useReviewInsights } from '@/features/review/insights'
import { usePlaceReviews, type PlaceReview, type ReviewTarget } from '@/features/review/queries'
import { translateText } from '@/features/translate/services'
import { appFlag, baseLang, flagFor } from '@/lib/flags'
import { useLocaleStore, useT } from '@/lib/i18n'
import { palette } from '@/theme/tokens'

export type { ReviewTarget }

function ReviewRow({
  review,
  appLang,
  translatedHint,
}: {
  review: PlaceReview
  appLang: string
  translatedHint?: string | null // 서버 캐시(review-insights) 번역 — 있으면 API 호출 없이 즉시 사용
}) {
  const t = useT()
  const needsTranslate = !!review.text && baseLang(review.lang) !== baseLang(appLang)
  const [fetched, setFetched] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  const translated = fetched ?? translatedHint ?? null
  const [busy, setBusy] = useState(false)
  const shake = useState(() => new Animated.Value(0))[0]

  // 미번역 외국어 리뷰 국기 — 주기적으로 떨려 "탭하면 번역" 유도
  useEffect(() => {
    if (!needsTranslate || translated) return
    let alive = true
    const wiggle = () => {
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]).start(() => {
        if (alive) setTimeout(() => alive && wiggle(), 2400)
      })
    }
    wiggle()
    return () => {
      alive = false
    }
  }, [needsTranslate, translated, shake])

  const onTapFlag = async () => {
    // 번역이 이미 있으면(캐시 힌트 포함) 원문↔번역 토글만 — 추가 API 호출 없음
    if (translated) {
      setShowOriginal((o) => !o)
      return
    }
    if (!needsTranslate || busy) return
    setBusy(true)
    try {
      const { translatedText } = await translateText({
        source: baseLang(review.lang),
        target: appLang,
        text: review.text,
      })
      setFetched(translatedText)
      setShowOriginal(false)
    } finally {
      setBusy(false)
    }
  }

  const showTranslated = !!translated && !showOriginal
  const flag = showTranslated ? appFlag(appLang) : review.flag || flagFor(review.lang)
  const text = showTranslated ? translated! : review.text
  const wobble = needsTranslate && !translated
  const rotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-11deg', '11deg'] })

  return (
    <View style={rs.reviewItem}>
      <Pressable
        onPress={onTapFlag}
        disabled={(!wobble && !translated) || busy}
        hitSlop={8}
        style={rs.reviewAvatar}>
        <Animated.Text style={[rs.reviewAvatarFlag, wobble && { transform: [{ rotate }] }]}>
          {flag}
        </Animated.Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={rs.reviewItemTop}>
          <Text style={rs.reviewWho}>{review.who}</Text>
          <View style={rs.reviewStars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Icon
                key={s}
                name="star"
                size={9}
                color={s <= review.score ? palette.amber[50] : palette.zinc[200]}
                filled
              />
            ))}
          </View>
          <Text style={rs.reviewTime}>{review.time}</Text>
        </View>
        <Text style={rs.reviewItemText}>{text}</Text>
        {wobble && (
          <Pressable onPress={onTapFlag} hitSlop={6}>
            <Text style={rs.reviewTapHint}>
              {busy ? '…' : `${flagFor(review.lang)} ${t('map.tapTranslate')}`}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

export function PlaceReviewsSection({ target }: { target: ReviewTarget }) {
  const t = useT()
  const lang = useLocaleStore((s) => s.lang)
  const { data: reviews } = usePlaceReviews(target, lang)
  const { data: insights } = useReviewInsights(target, lang)
  const reviewsMock = reviews?.provider === 'mock'

  // 캐시된 번역 힌트 — 작성자+원문 매칭
  const translatedFor = (r: PlaceReview) =>
    insights?.reviews.find((x) => x.who === r.who && x.text === r.text)?.translated ?? null

  // 출처 필터 — 카드 탭 시 해당 출처 리뷰만
  const [reviewFilter, setReviewFilter] = useState<'korean' | 'foreign' | null>(null)
  const shownReviews = useMemo(() => {
    const all = reviews?.reviews ?? []
    if (!reviewFilter) return all
    return all.filter((r) => {
      const isKo = baseLang(r.lang) === 'ko'
      return reviewFilter === 'korean' ? isKo : !isKo
    })
  }, [reviews, reviewFilter])

  // 외부 지도 열기 — 카드 우측 상단 아이콘만 (카드 본체는 필터 토글)
  const openExternal = (kind: 'naver' | 'google') => {
    if (target.lat == null || target.lng == null) return
    const name = encodeURIComponent(target.name)
    if (kind === 'naver') {
      const app = `nmap://place?lat=${target.lat}&lng=${target.lng}&name=${name}&appname=com.mangonw.gganbu`
      const web = `https://map.naver.com/p/search/${name}`
      Linking.openURL(app).catch(() => Linking.openURL(web).catch(() => {}))
      return
    }
    const placeId = insights?.placeKey
    const url = placeId
      ? `https://www.google.com/maps/search/?api=1&query=${name}&query_place_id=${placeId}`
      : `https://www.google.com/maps/search/?api=1&query=${target.lat},${target.lng}`
    Linking.openURL(url).catch(() => {})
  }

  return (
    <View>
      {/* 리뷰 — 두 관점 요약(실데이터, 언어별 분리) + 개별 리뷰 목록 */}
      <View style={rs.sectionTitleRow}>
        <Text style={rs.sectionTitle}>{t('map.reviews')}</Text>
        {reviews?.rating != null && (
          <Text style={rs.reviewOverall}>
            ★ {reviews.rating.toFixed(1)} · {reviews.total}
          </Text>
        )}
        {reviewsMock && <FallbackBadge label="Sample" />}
      </View>
      {/* AI 리뷰 요약(REQ-REV-1) — 장소×언어 서버 캐시로 사용자 간 재사용 */}
      {insights?.summary ? (
        <View style={rs.aiSummaryCard}>
          <View style={rs.aiSummaryHead}>
            <Icon name="auto_awesome" size={14} color={palette.blue[50]} filled />
            <Text style={rs.aiSummaryTitle}>{t('map.aiSummary')}</Text>
            {insights.provider === 'mock' && <FallbackBadge label="Sample" />}
          </View>
          <Text style={rs.aiSummaryText}>{insights.summary}</Text>
          {insights.sources && (
            <Text style={rs.aiSummarySrc}>
              Google {insights.sources.google} · Naver blog {insights.sources.naver}
            </Text>
          )}
        </View>
      ) : null}
      <View style={rs.reviewRow}>
        {/* 카드 = 출처 필터(탭하면 해당 리뷰만). 우측 상단 아이콘만 지도 앱 호출 */}
        <Pressable
          onPress={() => setReviewFilter((f) => (f === 'korean' ? null : 'korean'))}
          style={[
            rs.reviewCard,
            { borderColor: '#03C75A' },
            reviewFilter === 'korean' && rs.reviewCardSelN,
            reviewFilter === 'foreign' && rs.reviewCardDim,
          ]}>
          <View style={rs.reviewCardHead}>
            <View style={[rs.platformBadge, { backgroundColor: '#03C75A' }]}>
              <Text style={rs.platformBadgeText}>N</Text>
            </View>
            <Text style={rs.reviewCardTitle}>{t('map.reviewKorean')}</Text>
            <Pressable onPress={() => openExternal('naver')} hitSlop={10} style={rs.reviewExtBtn}>
              <Icon name="open_in_new" size={15} color="#03C75A" />
            </Pressable>
          </View>
          {reviews?.korean ? (
            <>
              <View style={rs.reviewStars}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Icon
                    key={i}
                    name="star"
                    size={11}
                    color={
                      i <= Math.round(reviews.korean!.score) ? palette.amber[50] : palette.zinc[200]
                    }
                    filled
                  />
                ))}
                <Text style={rs.reviewScore}>{reviews.korean.score.toFixed(1)}</Text>
              </View>
              <Text style={rs.reviewQuote} numberOfLines={2}>
                “{reviews.korean.text}”
              </Text>
            </>
          ) : (
            <Text style={rs.reviewNone}>{t('map.reviewNone')}</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => setReviewFilter((f) => (f === 'foreign' ? null : 'foreign'))}
          style={[
            rs.reviewCard,
            { borderColor: '#4285F4' },
            reviewFilter === 'foreign' && rs.reviewCardSelG,
            reviewFilter === 'korean' && rs.reviewCardDim,
          ]}>
          <View style={rs.reviewCardHead}>
            <View style={[rs.platformBadge, { backgroundColor: '#4285F4' }]}>
              <Text style={rs.platformBadgeText}>G</Text>
            </View>
            <Text style={rs.reviewCardTitle}>{t('map.reviewForeign')}</Text>
            <Pressable onPress={() => openExternal('google')} hitSlop={10} style={rs.reviewExtBtn}>
              <Icon name="open_in_new" size={15} color="#4285F4" />
            </Pressable>
          </View>
          {reviews?.foreign ? (
            <>
              <View style={rs.reviewStars}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Icon
                    key={i}
                    name="star"
                    size={11}
                    color={
                      i <= Math.round(reviews.foreign!.score)
                        ? palette.amber[50]
                        : palette.zinc[200]
                    }
                    filled
                  />
                ))}
                <Text style={rs.reviewScore}>{reviews.foreign.score.toFixed(1)}</Text>
              </View>
              <Text style={rs.reviewQuote} numberOfLines={2}>
                “{reviews.foreign.text}”
              </Text>
            </>
          ) : (
            <Text style={rs.reviewNone}>{t('map.reviewNone')}</Text>
          )}
        </Pressable>
      </View>
      {/* 개별 리뷰 — 선택된 출처 카드의 리뷰만(필터). 미선택 시 전체 */}
      {shownReviews.length === 0 && reviewFilter ? (
        <Text style={rs.reviewNone}>{t('map.reviewNone')}</Text>
      ) : null}
      {shownReviews.map((r, i) => (
        <ReviewRow key={i} review={r} appLang={lang} translatedHint={translatedFor(r)} />
      ))}
    </View>
  )
}

const rs = StyleSheet.create({
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: palette.zinc[700],
    marginTop: 12,
    marginBottom: 6,
  },
  reviewOverall: { fontSize: 12, fontWeight: '700', color: palette.amber[50] },
  aiSummaryCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#BFDBFE',
    padding: 12,
    gap: 6,
    marginBottom: 10,
  },
  aiSummaryHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiSummaryTitle: { fontSize: 12, fontWeight: '800', color: palette.blue[50], flex: 1 },
  aiSummaryText: { fontSize: 12.5, lineHeight: 18, color: palette.zinc[700] },
  aiSummarySrc: { fontSize: 10.5, color: palette.zinc[400] },
  reviewRow: { flexDirection: 'row', gap: 10 },
  reviewCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 10,
    backgroundColor: '#fff',
    gap: 5,
  },
  reviewCardSelN: { borderWidth: 2, backgroundColor: '#EFFBF3' },
  reviewCardSelG: { borderWidth: 2, backgroundColor: '#EFF4FE' },
  reviewCardDim: { opacity: 0.45 },
  reviewCardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  platformBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  reviewCardTitle: { flex: 1, fontSize: 11, fontWeight: '800', color: palette.zinc[800] },
  reviewExtBtn: { padding: 2 }, // 우측 상단 외부지도 아이콘(이것만 탭 시 지도 앱 호출)
  reviewStars: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  reviewScore: { fontSize: 11, fontWeight: '800', color: palette.zinc[700], marginLeft: 4 },
  reviewQuote: { fontSize: 11.5, color: palette.zinc[600], lineHeight: 16 },
  reviewNone: { fontSize: 11, color: palette.zinc[400], marginTop: 6, fontStyle: 'italic' },
  reviewItem: {
    flexDirection: 'row',
    gap: 9,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.zinc[200],
  },
  reviewAvatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarFlag: { fontSize: 16 },
  reviewItemTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewWho: { fontSize: 12, fontWeight: '700', color: palette.zinc[900] },
  reviewTime: { fontSize: 10, color: palette.zinc[400], marginLeft: 'auto' },
  reviewItemText: { fontSize: 12, color: palette.zinc[700], marginTop: 2, lineHeight: 17 },
  reviewTapHint: { fontSize: 10.5, color: palette.blue[50], fontWeight: '700', marginTop: 3 },
})
