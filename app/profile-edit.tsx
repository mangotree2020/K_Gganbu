// 프로필 등록 — 사진(카메라/갤러리) 또는 12지신 기본 아바타 + 성별·출생연도.
// 여권(passport_data)이 있으면 출생연도·성별 prefill.
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useMemo, useState } from 'react'
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { SheetHeader } from '@/components/SheetHeader'
import { usePassport } from '@/features/passport/queries'
import { useProfileStore } from '@/features/profile/store'
import {
  zodiacImageByAnimal,
  zodiacName,
  zodiacOf,
  ZODIAC_EMOJI,
  type Gender,
} from '@/features/profile/zodiac'
import { useLocaleStore, useT } from '@/lib/i18n'
import { palette, radius, shadows } from '@/theme/tokens'

// 여권 dateOfBirth(ISO 'YYYY-MM-DD' 또는 MRZ 'YYMMDD') → 4자리 연도
function yearFromDob(dob: string | null): number | null {
  if (!dob) return null
  const iso = dob.match(/^(\d{4})-\d{2}-\d{2}/)
  if (iso) return Number(iso[1])
  const mrz = dob.match(/^(\d{2})\d{4}$/)
  if (mrz) {
    const yy = Number(mrz[1])
    // 00~25 → 2000년대, 그 외 → 1900년대 (현재 2026 기준 합리적 컷오프)
    return yy <= 25 ? 2000 + yy : 1900 + yy
  }
  return null
}

function genderFromSex(sex: string | null): Gender | null {
  if (!sex) return null
  const s = sex.trim().toUpperCase()
  if (s.startsWith('F')) return 'female'
  if (s.startsWith('M')) return 'male'
  return null
}

export default function ProfileEditScreen() {
  const t = useT()
  const lang = useLocaleStore((s) => s.lang)
  const { data: passport } = usePassport()
  const store = useProfileStore()

  // 여권 prefill: 스토어 값이 비어 있을 때만 여권 값을 초기값으로 사용
  const ppYear = yearFromDob(passport?.dateOfBirth ?? null)
  const ppGender = genderFromSex(passport?.sex ?? null)

  // 프로필을 한 번도 저장한 적 없으면(birthYear 미설정) 여권 값으로 prefill
  const configured = store.birthYear != null

  const [displayName, setDisplayName] = useState(
    store.displayName || [passport?.givenName, passport?.surname].filter(Boolean).join(' '),
  )
  const [gender, setGender] = useState<Gender>(
    configured ? store.gender : (ppGender ?? store.gender),
  )
  const [yearText, setYearText] = useState(
    store.birthYear ? String(store.birthYear) : ppYear ? String(ppYear) : '',
  )
  const [photoUri, setPhotoUri] = useState<string | null>(store.photoUri)

  const birthYear = useMemo(() => {
    const n = Number(yearText)
    return yearText.length === 4 && n >= 1900 && n <= 2026 ? n : null
  }, [yearText])

  const animal = birthYear ? zodiacOf(birthYear) : null

  async function pick(source: 'camera' | 'library') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t('profile.permTitle'), t('profile.permBody'))
      return
    }
    const opts: ImagePicker.ImagePickerOptions = {
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    }
    const res =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts)
    if (!res.canceled && res.assets?.[0]?.uri) setPhotoUri(res.assets[0].uri)
  }

  function save() {
    store.setProfile({ displayName: displayName.trim(), gender, birthYear, photoUri })
    router.back()
  }

  // 현재 표시될 아바타 프리뷰
  const preview = photoUri ? { uri: photoUri } : animal ? zodiacImageByAnimal(gender, animal) : null

  return (
    <SafeAreaView style={ss.safe} edges={['top']}>
      <ScrollView contentContainerStyle={ss.scroll} showsVerticalScrollIndicator={false}>
        <SheetHeader title={t('profile.editTitle')} sub={t('profile.editSub')} icon="person" />

        {/* 아바타 프리뷰 */}
        <View style={ss.previewWrap}>
          <View style={[ss.preview, shadows.card]}>
            {preview ? (
              <Image source={preview} style={ss.previewImg} resizeMode="cover" />
            ) : (
              <Text style={{ fontSize: 56 }}>👤</Text>
            )}
          </View>
          {!photoUri && animal && (
            <View style={ss.zodiacBadge}>
              <Text style={ss.zodiacBadgeText}>
                {ZODIAC_EMOJI[animal]} {zodiacName(lang, animal)}
              </Text>
            </View>
          )}
        </View>

        {/* 사진 선택 */}
        <View style={ss.photoRow}>
          <Pressable style={[ss.photoBtn, shadows.card]} onPress={() => pick('camera')}>
            <Icon name="photo_camera" size={20} color={palette.blue[40]} />
            <Text style={ss.photoBtnText}>{t('profile.camera')}</Text>
          </Pressable>
          <Pressable style={[ss.photoBtn, shadows.card]} onPress={() => pick('library')}>
            <Icon name="photo_library" size={20} color={palette.blue[40]} />
            <Text style={ss.photoBtnText}>{t('profile.gallery')}</Text>
          </Pressable>
          {photoUri && (
            <Pressable style={[ss.photoBtn, shadows.card]} onPress={() => setPhotoUri(null)}>
              <Icon name="block" size={20} color={palette.coral[40]} />
              <Text style={[ss.photoBtnText, { color: palette.coral[40] }]}>
                {t('profile.useZodiac')}
              </Text>
            </Pressable>
          )}
        </View>

        {/* 이름 */}
        <Text style={ss.label}>{t('profile.name')}</Text>
        <TextInput
          style={ss.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('profile.namePlaceholder')}
          placeholderTextColor={palette.zinc[400]}
        />

        {/* 성별 */}
        <Text style={ss.label}>{t('profile.gender')}</Text>
        <View style={ss.segment}>
          {(['female', 'male'] as Gender[]).map((g) => {
            const on = gender === g
            return (
              <Pressable
                key={g}
                style={[ss.segBtn, on && ss.segBtnOn]}
                onPress={() => setGender(g)}>
                <Text style={[ss.segText, on && ss.segTextOn]}>
                  {g === 'female' ? `♀ ${t('profile.female')}` : `♂ ${t('profile.male')}`}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* 출생연도 */}
        <Text style={ss.label}>{t('profile.birthYear')}</Text>
        <TextInput
          style={ss.input}
          value={yearText}
          onChangeText={(v) => setYearText(v.replace(/[^0-9]/g, '').slice(0, 4))}
          placeholder={t('profile.birthYearPlaceholder')}
          placeholderTextColor={palette.zinc[400]}
          keyboardType="number-pad"
          maxLength={4}
        />
        <Text style={ss.hint}>{t('profile.birthYearHint')}</Text>

        <Pressable style={[ss.save, shadows.blue]} onPress={save}>
          <Text style={ss.saveText}>{t('profile.save')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const ss = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.zinc[50] },
  scroll: { padding: 16, paddingBottom: 40 },
  previewWrap: { alignItems: 'center', marginTop: 12, marginBottom: 18 },
  preview: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: palette.zinc[0],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: palette.zinc[0],
  },
  previewImg: { width: 132, height: 132 },
  zodiacBadge: {
    marginTop: 10,
    backgroundColor: palette.blue[90],
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  zodiacBadgeText: { color: palette.blue[30], fontWeight: '700', fontSize: 13 },
  photoRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: palette.zinc[0],
    paddingVertical: 12,
    borderRadius: radius.xl,
  },
  photoBtnText: { fontWeight: '700', color: palette.blue[40], fontSize: 13 },
  label: {
    fontWeight: '800',
    color: palette.zinc[800],
    fontSize: 13,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: palette.zinc[0],
    borderRadius: radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: palette.zinc[900],
    borderWidth: 1,
    borderColor: palette.zinc[200],
    marginBottom: 16,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: palette.zinc[100],
    borderRadius: radius.xl,
    padding: 4,
    marginBottom: 16,
  },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.lg },
  segBtnOn: { backgroundColor: palette.zinc[0], ...shadows.card },
  segText: { fontWeight: '700', color: palette.zinc[500], fontSize: 14 },
  segTextOn: { color: palette.blue[40] },
  hint: { color: palette.zinc[500], fontSize: 12, marginTop: -6, marginBottom: 22 },
  save: {
    backgroundColor: palette.blue[50],
    paddingVertical: 16,
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  saveText: { color: palette.zinc[0], fontWeight: '800', fontSize: 16 },
})
