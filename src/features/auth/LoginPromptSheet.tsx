// Guest 로그인 유도 시트 (BACKLOG #8) — 루트에 1회 마운트, 전역 store로 제어.
// 로그인 성공 시 보류 동작 이어서 실행(resolve), 취소/실패 시 friendly 안내 + 재시도.
import { router } from 'expo-router'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { Icon } from '@/components/brand'
import { useT } from '@/lib/i18n'
import { palette, shadows } from '@/theme/tokens'
import { useOAuthSignIn } from './queries'
import { useLoginPrompt } from './loginPrompt'

export function LoginPromptSheet() {
  const t = useT()
  const visible = useLoginPrompt((s) => s.visible)
  const reasonKey = useLoginPrompt((s) => s.reasonKey)
  const hide = useLoginPrompt((s) => s.hide)
  const resolve = useLoginPrompt((s) => s.resolve)

  const { mutateAsync: oauth, isPending, error, reset } = useOAuthSignIn()

  const onProvider = async (provider: 'google' | 'apple') => {
    try {
      await oauth(provider)
      resolve() // 로그인 성공 → 보류 동작 실행 + 시트 닫기
    } catch {
      // 에러는 error 상태로 표시, 시트 유지(재시도 가능)
    }
  }

  const onPhone = () => {
    hide()
    router.push('/(auth)/phone')
  }

  const onDismiss = () => {
    reset()
    hide()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={ss.backdrop} onPress={onDismiss} />
      <View style={[ss.sheet, shadows.pop]}>
        <View style={ss.grabber} />
        <View style={ss.iconBox}>
          <Icon name="bookmark" size={26} color={palette.coral[50]} filled />
        </View>
        <Text style={ss.title}>{t('auth.gateTitle')}</Text>
        <Text style={ss.sub}>{t(reasonKey)}</Text>

        {!!error && <Text style={ss.error}>{t('auth.failed')}</Text>}

        <Pressable
          disabled={isPending}
          onPress={() => onProvider('google')}
          style={({ pressed }) => [
            ss.btn,
            ss.btnLight,
            { opacity: pressed || isPending ? 0.85 : 1 },
          ]}>
          <Text style={ss.btnLightText}>{t('auth.withGoogle')}</Text>
        </Pressable>
        <Pressable
          disabled={isPending}
          onPress={() => onProvider('apple')}
          style={({ pressed }) => [
            ss.btn,
            ss.btnDark,
            { opacity: pressed || isPending ? 0.85 : 1 },
          ]}>
          <Text style={ss.btnDarkText}>{t('auth.withApple')}</Text>
        </Pressable>
        <Pressable
          disabled={isPending}
          onPress={onPhone}
          style={({ pressed }) => [ss.btn, ss.btnLight, { opacity: pressed ? 0.85 : 1 }]}>
          <Text style={ss.btnLightText}>{t('auth.withPhone')}</Text>
        </Pressable>

        <Pressable onPress={onDismiss} style={ss.guest}>
          <Text style={ss.guestText}>{t('auth.continueGuest')}</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const ss = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 34,
    alignItems: 'center',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.zinc[200],
    marginBottom: 18,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.coral[90],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 19, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.3 },
  sub: {
    fontSize: 13,
    color: palette.zinc[500],
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 19,
  },
  error: { fontSize: 12, color: palette.error[50], marginBottom: 10, textAlign: 'center' },
  btn: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  btnLight: { backgroundColor: palette.zinc[100], borderWidth: 1, borderColor: palette.zinc[200] },
  btnLightText: { fontSize: 15, fontWeight: '700', color: palette.zinc[900] },
  btnDark: { backgroundColor: palette.zinc[900] },
  btnDarkText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  guest: { marginTop: 4, paddingVertical: 8 },
  guestText: { fontSize: 13, fontWeight: '600', color: palette.zinc[500] },
})
