// 설정 (My → Settings) — 알림·위치 데이터·크루즈 토글 + 법적 고지·앱 버전
// 위치 데이터 토글은 REQ-LOC 개인정보 이중 게이트의 사용자 노출 UI (핑 수집 opt-out).
import Constants from 'expo-constants'
import { Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'

import { SheetHeader } from '@/components/SheetHeader'
import { useCruiseStore } from '@/features/cruise/prefs'
import { isPingsEnabled, setPingsEnabled } from '@/features/journey/pings'
import { enablePush } from '@/features/notifications/services'
import { usePushStore } from '@/features/notifications/store'
import { useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'

// 정적 호스팅 후 실 URL로 교체 (SETUP_EXTERNAL "QR 랜딩·Admin 호스팅"과 동일 체계)
const PRIVACY_URL = 'https://mangonw.com/kgganbu/privacy'
const TERMS_URL = 'https://mangonw.com/kgganbu/terms'

export default function SettingsScreen() {
  const t = useT()
  const pushEnabled = usePushStore((s) => s.enabled)
  const setPushEnabled = usePushStore((s) => s.setEnabled)
  const isCruise = useCruiseStore((s) => s.isCruise)
  const setCruise = useCruiseStore((s) => s.setCruise)
  // 위치 핑 토글 — MMKV 값이라 로컬 상태로 미러링
  const [pings, setPings] = useState(isPingsEnabled())

  const togglePush = async (on: boolean) => {
    if (!on) {
      setPushEnabled(false)
      return
    }
    const ok = await enablePush()
    setPushEnabled(ok)
  }

  const togglePings = (on: boolean) => {
    setPingsEnabled(on)
    setPings(on)
  }

  const version = Constants.expoConfig?.version ?? '1.0.0'

  return (
    <SafeAreaView style={ss.container} edges={['top']}>
      <SheetHeader title={t('common.settings')} sub={t('settings.sub')} icon="settings" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {/* 토글 그룹 */}
        <View style={[ss.card, shadows.card]}>
          <View style={ss.row}>
            <Text style={ss.rowEmoji}>🔔</Text>
            <Text style={ss.rowLabel}>{t('profile.notifications')}</Text>
            <Switch
              value={pushEnabled}
              onValueChange={togglePush}
              trackColor={{ true: palette.blue[50] }}
            />
          </View>
          <View style={[ss.row, ss.rowBorder]}>
            <Text style={ss.rowEmoji}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={ss.rowLabel}>{t('settings.locationData')}</Text>
              <Text style={ss.rowSub}>{t('settings.locationDataSub')}</Text>
            </View>
            <Switch
              value={pings}
              onValueChange={togglePings}
              trackColor={{ true: palette.blue[50] }}
            />
          </View>
          <View style={[ss.row, ss.rowBorder]}>
            <Text style={ss.rowEmoji}>🚢</Text>
            <Text style={ss.rowLabel}>{t('cruise.title')}</Text>
            <Switch
              value={isCruise}
              onValueChange={setCruise}
              trackColor={{ true: palette.blue[50] }}
            />
          </View>
        </View>

        {/* 법적 고지 */}
        <View style={[ss.card, shadows.card]}>
          <Text style={ss.rowLink} onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}>
            {t('settings.privacy')}
          </Text>
          <Text
            style={[ss.rowLink, ss.rowBorderTop]}
            onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}>
            {t('settings.terms')}
          </Text>
        </View>

        {/* 버전 */}
        <View style={ss.versionRow}>
          <Text style={ss.versionText}>
            {t('settings.version')} {version}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.zinc[200] },
  rowEmoji: { fontSize: 17 },
  rowLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', color: palette.zinc[900] },
  rowSub: { fontSize: 11, color: palette.zinc[500], marginTop: 2 },
  rowLink: {
    fontSize: 13.5,
    fontWeight: '600',
    color: palette.blue[50],
    paddingVertical: 13,
  },
  rowBorderTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.zinc[200] },
  versionRow: { alignItems: 'center', paddingVertical: 8 },
  versionText: { fontSize: 11.5, color: palette.zinc[400] },
})
