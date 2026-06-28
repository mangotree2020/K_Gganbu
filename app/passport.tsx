// 여권 등록 → 쇼핑 면세 (#26) — 촬영/갤러리 → passport-ocr OCR → passport_data 저장.
// 등록되면 여권 카드 + 면세 안내, 미등록이면 스캔 CTA + 개인정보 동의 안내.
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { usePassport, useRemovePassport, useScanPassport } from '@/features/passport/queries'
import { useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

export default function PassportScreen() {
  const t = useT()
  const { data: passport, isLoading } = usePassport()
  const scan = useScanPassport()
  const remove = useRemovePassport()

  const onScan = async (source: 'camera' | 'library') => {
    try {
      const res = await scan.mutateAsync(source)
      if (!res) return // 취소
      if (!res.success) {
        Alert.alert(t('passport.failTitle'), t('passport.failSub'))
      }
    } catch (e) {
      const msg = e instanceof Error && e.message === 'permission_denied'
      Alert.alert(t('passport.failTitle'), msg ? t('passport.permission') : t('passport.error'))
    }
  }

  const onRemove = () => {
    Alert.alert(t('passport.remove'), t('passport.removeConfirm'), [
      { text: t('passport.cancel'), style: 'cancel' },
      { text: t('passport.remove'), style: 'destructive', onPress: () => remove.mutate() },
    ])
  }

  const busy = scan.isPending

  return (
    <View style={ss.container}>
      <LinearGradient
        colors={['#1E3A5F', '#0EA5E9', '#0D9488']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <View style={ss.header}>
            <View style={ss.headerIcon}>
              <Text style={{ fontSize: 22 }}>🛂</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.headerTitle}>{t('passport.title')}</Text>
              <Text style={ss.headerSub}>{t('passport.headerSub')}</Text>
            </View>
            <Pressable onPress={() => router.back()} style={ss.close}>
              <Icon name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {isLoading ? (
          <View style={ss.center}>
            <ActivityIndicator color={palette.teal[40]} />
          </View>
        ) : passport ? (
          // ── 등록됨 ──
          <>
            <View style={[ss.card, shadows.card]}>
              <LinearGradient
                colors={['#1E3A5F', '#0EA5E9', '#0D9488']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={ss.passCardTop}>
                <Text style={{ fontSize: 28 }}>🛂</Text>
                <View style={{ flex: 1 }}>
                  <Text style={ss.passName}>
                    {passport.surname}
                    {passport.givenName ? `, ${passport.givenName}` : ''}
                  </Text>
                  <View style={ss.passMetaRow}>
                    <Icon
                      name={passport.isValid ? 'check_circle' : 'circle'}
                      size={12}
                      color={passport.isValid ? '#86EFAC' : '#FCA5A5'}
                      filled
                    />
                    <Text style={ss.passMeta}>
                      {passport.nationality ?? '—'} · {t('passport.exp')}{' '}
                      {passport.expiryDate ?? '—'}
                    </Text>
                  </View>
                </View>
                <View style={ss.taxBadge}>
                  <Icon name="local_activity" size={12} color="#FDE68A" filled />
                  <Text style={ss.taxBadgeText}>{t('passport.taxFreeOn')}</Text>
                </View>
              </LinearGradient>
              <View style={ss.fields}>
                {[
                  { l: t('passport.fieldNumber'), v: passport.passportNumber },
                  { l: t('passport.fieldNationality'), v: passport.nationality },
                  { l: t('passport.fieldBirth'), v: passport.dateOfBirth },
                  { l: t('passport.fieldExpiry'), v: passport.expiryDate },
                ].map((f) => (
                  <View key={f.l} style={ss.fieldRow}>
                    <Text style={ss.fieldLabel}>{f.l}</Text>
                    <Text style={ss.fieldValue}>{f.v ?? '—'}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 면세 안내 */}
            <View style={[ss.infoCard, shadows.card]}>
              <Text style={ss.infoTitle}>✈️ {t('passport.taxInfoTitle')}</Text>
              <Text style={ss.infoText}>{t('passport.taxInfoBody')}</Text>
            </View>

            {/* VAT 환급 추적 진입 (#26 Phase 2) */}
            <Pressable
              onPress={() => router.push('/tax-free')}
              style={[ss.refundCta, shadows.card]}>
              <View style={ss.refundIcon}>
                <Icon name="local_activity" size={20} color={palette.teal[30]} filled />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ss.refundTitle}>{t('taxfree.title')}</Text>
                <Text style={ss.refundSub}>{t('taxfree.sub')}</Text>
              </View>
              <Icon name="chevron_right" size={20} color={palette.zinc[400]} />
            </Pressable>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => onScan('camera')}
                disabled={busy}
                style={[ss.btnAlt, busy && { opacity: 0.6 }]}>
                <Icon name="photo_camera" size={18} color={palette.teal[30]} />
                <Text style={ss.btnAltText}>{t('passport.rescan')}</Text>
              </Pressable>
              <Pressable
                onPress={onRemove}
                disabled={remove.isPending}
                style={[ss.btnDanger, remove.isPending && { opacity: 0.6 }]}>
                <Icon name="block" size={18} color={palette.error[50]} />
                <Text style={ss.btnDangerText}>{t('passport.remove')}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          // ── 미등록 ──
          <>
            <View style={ss.hint}>
              <View style={ss.hintIcon}>
                <Text style={{ fontSize: 34 }}>🛂</Text>
              </View>
              <Text style={ss.hintTitle}>{t('passport.scanTitle')}</Text>
              <Text style={ss.hintSub}>{t('passport.scanSub')}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => onScan('camera')}
                disabled={busy}
                style={[ss.btn, busy && { opacity: 0.6 }]}>
                <Icon name="photo_camera" size={18} color="#fff" filled />
                <Text style={ss.btnText}>
                  {busy ? t('passport.reading') : t('passport.takePhoto')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onScan('library')}
                disabled={busy}
                style={[ss.btnAlt, busy && { opacity: 0.6 }]}>
                <Icon name="photo_library" size={18} color={palette.teal[30]} />
                <Text style={ss.btnAltText}>{t('passport.gallery')}</Text>
              </Pressable>
            </View>

            {busy && (
              <View style={ss.reading}>
                <ActivityIndicator color={palette.teal[40]} />
                <Text style={ss.readingText}>{t('passport.reading')}</Text>
              </View>
            )}

            {/* 혜택 + 개인정보 */}
            <View style={[ss.infoCard, shadows.card, { marginTop: 16 }]}>
              {[
                `✈️ ${t('passport.perk1')}`,
                `🧾 ${t('passport.perk2')}`,
                `🔒 ${t('passport.perk3')}`,
              ].map((p) => (
                <Text key={p} style={ss.perk}>
                  {p}
                </Text>
              ))}
              <View style={ss.consentBox}>
                <Text style={{ fontSize: 13 }}>🔒</Text>
                <Text style={ss.consent}>{t('passport.consent')}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 16,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,.9)', marginTop: 1 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { paddingVertical: 60, alignItems: 'center' },

  card: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden' },
  passCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  passName: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  passMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  passMeta: { fontSize: 11, color: 'rgba(255,255,255,.9)' },
  taxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,.18)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  taxBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  fields: { paddingHorizontal: 16, paddingVertical: 6 },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.zinc[100],
  },
  fieldLabel: { fontSize: 12.5, color: palette.zinc[500] },
  fieldValue: { fontSize: 13.5, fontWeight: '700', color: palette.zinc[900] },

  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    padding: 14,
    marginTop: 12,
  },
  infoTitle: { fontSize: 13, fontWeight: '800', color: palette.zinc[900] },
  infoText: { fontSize: 12, color: palette.zinc[600], lineHeight: 18, marginTop: 4 },
  refundCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  refundIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.teal[90],
    alignItems: 'center',
    justifyContent: 'center',
  },
  refundTitle: { fontSize: 14, fontWeight: '800', color: palette.zinc[900] },
  refundSub: { fontSize: 12, color: palette.zinc[500], marginTop: 2 },
  perk: { fontSize: 12.5, color: palette.zinc[700], fontWeight: '600', paddingVertical: 3 },
  consentBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.zinc[200],
  },
  consent: { flex: 1, fontSize: 11, color: palette.zinc[500], lineHeight: 16 },

  hint: { alignItems: 'center', gap: 8, paddingVertical: 26 },
  hintIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: palette.teal[95],
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintTitle: { fontSize: 17, fontWeight: '800', color: palette.zinc[900], marginTop: 4 },
  hintSub: {
    fontSize: 13,
    color: palette.zinc[500],
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 16,
  },

  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.teal[40],
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnAlt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.teal[95],
    borderWidth: 1,
    borderColor: palette.teal[80],
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnAltText: { color: palette.teal[30], fontSize: 14, fontWeight: '700' },
  btnDanger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    paddingVertical: 14,
  },
  btnDangerText: { color: palette.error[50], fontSize: 14, fontWeight: '700' },
  reading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  readingText: { fontSize: 13, color: palette.zinc[500], fontWeight: '600' },
})
