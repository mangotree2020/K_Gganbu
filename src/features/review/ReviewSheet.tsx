// 공용 후기 작성 시트 — 방문한 장소에 별점(필수) + 한 줄 후기(선택) + 사진(공개 시)을 남긴다.
// 쿠폰 QR 화면의 1탭 별점(UX_REVIEW §4-4)은 "사용 직후 즉시성"이 목적이라 그대로 두고,
// 이 시트는 그 외 경로(길찾기 도착, 지갑의 사용한 쿠폰·티켓, 장소 상세)를 담당한다.
// 본문 입력이 없어 reviews.body가 늘 비어 있던 공백(피드가 별 문자열만 표시)도 여기서 메운다.
import * as ImagePicker from 'expo-image-picker'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { Icon } from '@/components/brand'
import { useProfileStore } from '@/features/profile/store'
import { useT } from '@/lib/i18n'
import { palette, radius, shadows } from '@/theme/tokens'
import { addReview, uploadReviewPhoto } from './services'

export type ReviewTargetPlace = {
  placeKey: string // 로컬 방문 기록 키 (= addReview.placeKey)
  name: string
  cat?: string | null
  refId?: string | null // 쿠폰 발급 id — 있으면 서버 unique 가 사용 1건당 1후기를 강제
}

type Props = {
  visible: boolean
  place: ReviewTargetPlace | null
  onClose: () => void
  // 저장 성공 시 호출 — 호출측이 방문 기록을 '후기 완료'로 표시한다
  onSaved?: (placeKey: string) => void
}

const STARS = [1, 2, 3, 4, 5]
const MAX_BODY = 300

export function ReviewSheet({ visible, place, onClose, onSaved }: Props) {
  const t = useT()
  const authorName = useProfileStore((s) => s.displayName) || 'Traveler'
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [sharePublic, setSharePublic] = useState(false)
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)
  // 연타 잠금은 렌더 상태가 아니라 ref로 — 같은 렌더의 saving=false 클로저로 두 요청이 나갈 수 있다
  const submittingRef = useRef(false)
  // 업로드 성공한 사진 URL — 저장 실패 후 재시도할 때 같은 사진을 다시 올리지 않는다(고아 파일 방지)
  const uploadedRef = useRef<string | null>(null)
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  const reset = () => {
    setRating(0)
    setBody('')
    setSharePublic(false)
    setPhotoUri(null)
    setSaving(false)
    setDone(false)
    setFailed(false)
    uploadedRef.current = null
  }

  // 저장 중에는 닫지 않는다 — 닫고 다른 장소 시트를 열면 이전 요청의 완료가 그 장소를
  // 후기 완료로 만들어 버린다(대상이 뒤바뀐 오처리).
  const close = () => {
    if (submittingRef.current) return
    reset()
    onClose()
  }

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    if (!r.canceled && r.assets[0]?.uri) setPhotoUri(r.assets[0].uri)
  }

  const submit = async () => {
    if (!place || !rating || submittingRef.current) return
    submittingRef.current = true
    setSaving(true)
    setFailed(false)
    try {
      // 사진은 부가 정보 — 업로드가 실패해도(null) 후기는 저장한다
      const photoUrl =
        sharePublic && photoUri ? (uploadedRef.current ??= await uploadReviewPhoto(photoUri)) : null
      const saved = await addReview({
        placeName: place.name,
        rating,
        cat: place.cat ?? undefined,
        body: body.trim() || undefined,
        placeKey: place.placeKey,
        refId: place.refId ?? null,
        isPublic: sharePublic,
        authorName,
        photos: photoUrl ? [photoUrl] : [],
      })
      // addReview는 세션이 없으면 예외 대신 false를 돌려준다 — 성공으로 오인하면
      // 후기도 재시도 기회도 함께 사라진다.
      if (!saved) throw new Error('not_saved')
      if (!aliveRef.current) return
      onSaved?.(place.placeKey)
      setDone(true)
    } catch {
      // 저장 실패 — 시트는 닫지 않고 다시 시도할 수 있게 둔다
      if (aliveRef.current) setFailed(true)
    } finally {
      submittingRef.current = false
      if (aliveRef.current) setSaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={ss.backdrop} onPress={close} />
      <View style={[ss.sheet, shadows.pop]}>
        <View style={ss.grip} />
        {done ? (
          <View style={ss.doneBox}>
            <Text style={{ fontSize: 34 }}>🙏</Text>
            <Text style={ss.title}>{t('review.thanks')}</Text>
            <Pressable onPress={close} style={ss.submitBtn}>
              <Text style={ss.submitText}>{t('common.ok')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={ss.title}>{t('review.askTitle')}</Text>
            <Text style={ss.place} numberOfLines={1}>
              {place?.name ?? ''}
            </Text>

            <View style={ss.stars}>
              {STARS.map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                  <Icon
                    name="star"
                    size={34}
                    color={n <= rating ? palette.amber[50] : palette.zinc[300]}
                    filled={n <= rating}
                  />
                </Pressable>
              ))}
            </View>

            <TextInput
              value={body}
              onChangeText={(v) => setBody(v.slice(0, MAX_BODY))}
              placeholder={t('review.bodyPlaceholder')}
              placeholderTextColor={palette.zinc[400]}
              multiline
              style={ss.input}
            />

            {/* 피드 공개 동의 — 기본 꺼짐. 켜야 사진 첨부가 의미를 갖는다 */}
            <Pressable onPress={() => setSharePublic((v) => !v)} hitSlop={6} style={ss.row}>
              <Icon
                name={sharePublic ? 'check_circle' : 'circle'}
                size={16}
                color={sharePublic ? palette.success[50] : palette.zinc[400]}
                filled={sharePublic}
              />
              <Text style={ss.rowText}>{t('review.shareToFeed')}</Text>
            </Pressable>
            {sharePublic && (
              <Pressable onPress={pickPhoto} hitSlop={6} style={ss.row}>
                <Icon name="photo_camera" size={16} color={palette.blue[50]} />
                <Text style={[ss.rowText, { color: palette.blue[50] }]}>
                  {photoUri ? t('review.photoAdded') : t('review.addPhoto')}
                </Text>
              </Pressable>
            )}

            {failed && <Text style={ss.error}>{t('review.saveFailed')}</Text>}

            <View style={ss.actions}>
              <Pressable onPress={close} style={ss.laterBtn}>
                <Text style={ss.laterText}>{t('review.later')}</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!rating || saving}
                style={[ss.submitBtn, (!rating || saving) && ss.submitDisabled]}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={ss.submitText}>{t('review.submit')}</Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  )
}

const ss = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    paddingBottom: 28,
    gap: 10,
  },
  grip: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.zinc[200],
    alignSelf: 'center',
    marginBottom: 6,
  },
  title: { fontSize: 18, fontWeight: '800', color: palette.zinc[800], textAlign: 'center' },
  place: { fontSize: 13, color: palette.zinc[500], textAlign: 'center' },
  stars: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: 6 },
  input: {
    minHeight: 76,
    borderWidth: 1,
    borderColor: palette.zinc[200],
    borderRadius: radius.lg,
    padding: 12,
    fontSize: 14,
    color: palette.zinc[800],
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  rowText: { fontSize: 13, color: palette.zinc[600] },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  laterBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.lg,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
  },
  laterText: { fontSize: 15, fontWeight: '700', color: palette.zinc[600] },
  submitBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.lg,
    backgroundColor: palette.coral[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { backgroundColor: palette.zinc[300] },
  submitText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  doneBox: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  error: { fontSize: 12, color: palette.error[50], textAlign: 'center' },
})
