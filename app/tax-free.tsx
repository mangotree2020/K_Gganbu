// 사후면세 환급 추적 (#26 Phase 2) — 영수증 누적 → 총 지출·예상 환급 추적 + 공항 환급 코드.
// 영수증은 스캔(receipt-ocr) 또는 직접 입력. 부가세 환급 추정은 types.estimateRefund(추정치).
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'

import { Icon } from '@/components/brand'
import { SheetHeader } from '@/components/SheetHeader'
import { usePassport } from '@/features/passport/queries'
import {
  useAddReceipt,
  useReceipts,
  useRemoveReceipt,
  useScanReceipt,
} from '@/features/taxfree/queries'
import { estimateRefund, isEligible, summarize } from '@/features/taxfree/types'
import { useT } from '@/lib/i18n'
import { palette, radius, shadows } from '@/theme/tokens'

const won = (n: number) => `₩${Math.round(n).toLocaleString('en-US')}`

export default function TaxFreeScreen() {
  const t = useT()
  const { data: passport } = usePassport()
  const { data: receipts = [], isLoading } = useReceipts()
  const add = useAddReceipt()
  const scan = useScanReceipt()
  const remove = useRemoveReceipt()

  const [addOpen, setAddOpen] = useState(false)
  const [store, setStore] = useState('')
  const [amountText, setAmountText] = useState('')

  const summary = useMemo(() => summarize(receipts), [receipts])
  const busy = scan.isPending

  async function onScan(source: 'camera' | 'library') {
    try {
      const res = await scan.mutateAsync(source)
      if (res && !res.success) Alert.alert(t('taxfree.title'), t('taxfree.scanFail'))
    } catch (e) {
      if ((e as Error).message === 'permission_denied')
        Alert.alert(t('profile.permTitle'), t('profile.permBody'))
      else Alert.alert(t('taxfree.title'), t('taxfree.scanFail'))
    }
  }

  function onAdd() {
    const amount = Number(amountText.replace(/[^0-9]/g, ''))
    if (!store.trim() || !amount) return
    add.mutate(
      { storeName: store.trim(), totalAmount: amount },
      {
        onSuccess: () => {
          setStore('')
          setAmountText('')
          setAddOpen(false)
        },
      },
    )
  }

  // 공항 환급 코드 — 여권번호 + 총 예상환급(키오스크 조회용 placeholder 페이로드)
  const claimPayload = passport?.passportNumber
    ? JSON.stringify({
        v: 1,
        passport: passport.passportNumber,
        refund: Math.round(summary.totalRefund),
        count: summary.eligibleCount,
      })
    : null

  return (
    <SafeAreaView style={ss.safe} edges={['top']}>
      <ScrollView contentContainerStyle={ss.scroll} showsVerticalScrollIndicator={false}>
        <SheetHeader
          title={t('taxfree.title')}
          sub={t('taxfree.sub')}
          icon="local_activity"
          accent={palette.teal[30]}
          accentBg={palette.teal[90]}
        />

        {/* 요약 카드 */}
        <View style={[ss.summary, shadows.card]}>
          <View style={ss.sumMain}>
            <Text style={ss.sumLabel}>{t('taxfree.estRefund')}</Text>
            <Text style={ss.sumRefund}>{won(summary.totalRefund)}</Text>
          </View>
          <View style={ss.sumRow}>
            <View style={ss.sumCell}>
              <Text style={ss.sumCellLabel}>{t('taxfree.totalSpent')}</Text>
              <Text style={ss.sumCellValue}>{won(summary.totalSpent)}</Text>
            </View>
            <View style={ss.sumDivider} />
            <View style={ss.sumCell}>
              <Text style={ss.sumCellLabel}>{t('taxfree.eligible')}</Text>
              <Text style={ss.sumCellValue}>{summary.eligibleCount}</Text>
            </View>
          </View>
        </View>

        {/* 액션 */}
        <View style={ss.actions}>
          <Pressable
            style={[ss.actScan, shadows.blue, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={() => onScan('camera')}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Icon name="photo_camera" size={20} color="#fff" />
            )}
            <Text style={ss.actScanText}>{t('taxfree.scan')}</Text>
          </Pressable>
          <Pressable
            style={[ss.actAlt, shadows.card]}
            disabled={busy}
            onPress={() => onScan('library')}>
            <Icon name="photo_library" size={20} color={palette.blue[40]} />
          </Pressable>
          <Pressable style={[ss.actAlt, shadows.card]} onPress={() => setAddOpen(true)}>
            <Icon name="add" size={22} color={palette.blue[40]} />
          </Pressable>
        </View>

        {/* 영수증 목록 */}
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 28 }} color={palette.blue[50]} />
        ) : receipts.length === 0 ? (
          <View style={ss.empty}>
            <Text style={{ fontSize: 40 }}>🧾</Text>
            <Text style={ss.emptyText}>{t('taxfree.empty')}</Text>
          </View>
        ) : (
          <View style={{ marginTop: 18, gap: 10 }}>
            {receipts.map((r) => {
              const eligible = isEligible(r.totalAmount)
              return (
                <View key={r.id} style={[ss.receipt, shadows.card]}>
                  <View style={ss.receiptIcon}>
                    <Text style={{ fontSize: 20 }}>{r.source === 'scanned' ? '📷' : '🧾'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={ss.receiptStore} numberOfLines={1}>
                      {r.storeName || '—'}
                    </Text>
                    <Text style={ss.receiptMeta}>
                      {won(r.totalAmount)}
                      {r.purchaseDate ? ` · ${r.purchaseDate}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    {eligible ? (
                      <Text style={ss.receiptRefund}>+{won(r.vatRefund)}</Text>
                    ) : (
                      <Text style={ss.receiptIneligible}>{t('taxfree.notEligible')}</Text>
                    )}
                    <Pressable hitSlop={8} onPress={() => remove.mutate(r.id)}>
                      <Icon name="block" size={15} color={palette.zinc[400]} />
                    </Pressable>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* 공항 환급 코드 */}
        <View style={[ss.claim, shadows.card]}>
          <Text style={ss.claimTitle}>✈️ {t('taxfree.claimTitle')}</Text>
          {claimPayload ? (
            <>
              <View style={ss.qrBox}>
                <QRCode
                  value={claimPayload}
                  size={150}
                  backgroundColor="#fff"
                  color={palette.zinc[900]}
                />
              </View>
              <Text style={ss.claimSub}>{t('taxfree.claimSub')}</Text>
            </>
          ) : (
            <Pressable style={ss.claimCta} onPress={() => router.push('/passport')}>
              <Icon name="arrow_forward" size={16} color={palette.blue[40]} />
              <Text style={ss.claimCtaText}>{t('taxfree.claimNeedPassport')}</Text>
            </Pressable>
          )}
        </View>

        <Text style={ss.note}>{t('taxfree.minNote')}</Text>
      </ScrollView>

      {/* 직접 입력 모달 */}
      <Modal
        visible={addOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddOpen(false)}>
        <Pressable style={ss.backdrop} onPress={() => setAddOpen(false)}>
          <Pressable style={ss.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={ss.handle} />
            <Text style={ss.sheetTitle}>{t('taxfree.addTitle')}</Text>

            <Text style={ss.label}>{t('taxfree.store')}</Text>
            <TextInput
              style={ss.input}
              value={store}
              onChangeText={setStore}
              placeholder={t('taxfree.storePlaceholder')}
              placeholderTextColor={palette.zinc[400]}
            />

            <Text style={ss.label}>{t('taxfree.amount')}</Text>
            <TextInput
              style={ss.input}
              value={amountText}
              onChangeText={(v) => setAmountText(v.replace(/[^0-9]/g, ''))}
              placeholder={t('taxfree.amountPlaceholder')}
              placeholderTextColor={palette.zinc[400]}
              keyboardType="number-pad"
            />
            {!!amountText && (
              <Text style={ss.estLine}>
                {t('taxfree.estRefund')}: {won(estimateRefund(Number(amountText)))}
              </Text>
            )}

            <Pressable
              style={[
                ss.saveBtn,
                (!store.trim() || !amountText || add.isPending) && { opacity: 0.5 },
              ]}
              disabled={!store.trim() || !amountText || add.isPending}
              onPress={onAdd}>
              <Text style={ss.saveBtnText}>{t('profile.save')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const ss = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.zinc[50] },
  scroll: { padding: 16, paddingBottom: 40 },
  summary: {
    backgroundColor: palette.zinc[0],
    borderRadius: radius['2xl'],
    padding: 18,
    marginTop: 8,
  },
  sumMain: { alignItems: 'center', marginBottom: 14 },
  sumLabel: { fontSize: 12, color: palette.zinc[500], fontWeight: '700' },
  sumRefund: { fontSize: 34, fontWeight: '900', color: palette.teal[40], marginTop: 2 },
  sumRow: { flexDirection: 'row', alignItems: 'center' },
  sumCell: { flex: 1, alignItems: 'center' },
  sumDivider: { width: 1, height: 28, backgroundColor: palette.zinc[200] },
  sumCellLabel: { fontSize: 11, color: palette.zinc[500] },
  sumCellValue: { fontSize: 16, fontWeight: '800', color: palette.zinc[800], marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actScan: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.blue[50],
    paddingVertical: 14,
    borderRadius: radius.xl,
  },
  actScanText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  actAlt: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.zinc[0],
    borderRadius: radius.xl,
  },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyText: {
    color: palette.zinc[500],
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  receipt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.zinc[0],
    borderRadius: radius.xl,
    padding: 12,
  },
  receiptIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptStore: { fontSize: 15, fontWeight: '700', color: palette.zinc[900] },
  receiptMeta: { fontSize: 12.5, color: palette.zinc[500], marginTop: 2 },
  receiptRefund: { fontSize: 15, fontWeight: '800', color: palette.teal[40] },
  receiptIneligible: {
    fontSize: 10.5,
    color: palette.zinc[400],
    maxWidth: 110,
    textAlign: 'right',
  },
  claim: {
    backgroundColor: palette.zinc[0],
    borderRadius: radius['2xl'],
    padding: 18,
    marginTop: 18,
    alignItems: 'center',
  },
  claimTitle: { fontSize: 15, fontWeight: '800', color: palette.zinc[800] },
  qrBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.zinc[200],
  },
  claimSub: {
    marginTop: 12,
    fontSize: 12,
    color: palette.zinc[500],
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },
  claimCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: palette.blue[90],
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  claimCtaText: { color: palette.blue[40], fontWeight: '700', fontSize: 12.5, flexShrink: 1 },
  note: {
    marginTop: 16,
    fontSize: 11.5,
    color: palette.zinc[400],
    lineHeight: 17,
    textAlign: 'center',
  },
  // 모달
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.zinc[0],
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: palette.zinc[300],
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: palette.zinc[900], marginBottom: 12 },
  label: { fontWeight: '800', color: palette.zinc[800], fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: palette.zinc[50],
    borderRadius: radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: palette.zinc[900],
    borderWidth: 1,
    borderColor: palette.zinc[200],
    marginBottom: 14,
  },
  estLine: {
    fontSize: 13,
    color: palette.teal[40],
    fontWeight: '700',
    marginTop: -6,
    marginBottom: 14,
  },
  saveBtn: {
    backgroundColor: palette.blue[50],
    paddingVertical: 15,
    borderRadius: radius.xl,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
})
