import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { useSendOtp, useVerifyOtp } from '@/features/auth/queries'
import { palette, shadows } from '@/theme/tokens'

export default function PhoneScreen() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState('')

  const send = useSendOtp()
  const verify = useVerifyOtp()

  const onSend = () => {
    // E.164 형식 보정 (국내 0 제거 + 국가코드)
    const normalized = phone.startsWith('+') ? phone : `+82${phone.replace(/^0/, '')}`
    send.mutate({ phone: normalized }, { onSuccess: () => setStep('otp') })
  }

  const onVerify = () => {
    const normalized = phone.startsWith('+') ? phone : `+82${phone.replace(/^0/, '')}`
    verify.mutate({ phone: normalized, token })
  }

  return (
    <SafeAreaView style={ss.container}>
      <View style={ss.header}>
        <Pressable onPress={() => router.back()} style={ss.back}>
          <Icon name="arrow_back" size={20} color={palette.zinc[700]} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
        <View style={ss.iconBox}>
          <Icon name="sms" size={26} color={palette.blue[40]} filled />
        </View>
        <Text style={ss.title}>{step === 'phone' ? 'Sign in with phone' : 'Enter the code'}</Text>
        <Text style={ss.sub}>
          {step === 'phone'
            ? 'We’ll text a 6-digit code. Works with your home number — no Korean SIM needed.'
            : `Sent to ${phone}. Enter the 6-digit code.`}
        </Text>

        {step === 'phone' ? (
          <>
            <View style={ss.field}>
              <Text style={ss.cc}>🇰🇷 +82</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="10-1234-5678"
                placeholderTextColor={palette.zinc[400]}
                keyboardType="phone-pad"
                style={ss.input}
              />
            </View>
            {send.error && <Text style={ss.error}>{send.error.message}</Text>}
            <Pressable
              onPress={onSend}
              disabled={send.isPending || phone.length < 8}
              style={[ss.btn, { opacity: send.isPending || phone.length < 8 ? 0.6 : 1 }]}>
              <Text style={ss.btnText}>{send.isPending ? 'Sending…' : 'Send code'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={ss.field}>
              <TextInput
                value={token}
                onChangeText={setToken}
                placeholder="000000"
                placeholderTextColor={palette.zinc[400]}
                keyboardType="number-pad"
                maxLength={6}
                style={[ss.input, { letterSpacing: 8, fontSize: 20, textAlign: 'center' }]}
              />
            </View>
            {verify.error && <Text style={ss.error}>{verify.error.message}</Text>}
            <Pressable
              onPress={onVerify}
              disabled={verify.isPending || token.length < 6}
              style={[ss.btn, { opacity: verify.isPending || token.length < 6 ? 0.6 : 1 }]}>
              <Text style={ss.btnText}>
                {verify.isPending ? 'Verifying…' : 'Verify & continue'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setStep('phone')}
              style={{ alignItems: 'center', marginTop: 14 }}>
              <Text style={{ fontSize: 13, color: palette.blue[50], fontWeight: '600' }}>
                Change number
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 20, paddingTop: 4 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.blue[95],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 25, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.5 },
  sub: { fontSize: 13, color: palette.zinc[500], marginTop: 6, lineHeight: 19 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.zinc[50],
    borderWidth: 1,
    borderColor: palette.zinc[200],
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 56,
    marginTop: 22,
  },
  cc: { fontSize: 15, fontWeight: '700', color: palette.zinc[800] },
  input: { flex: 1, fontSize: 16, color: palette.zinc[900], padding: 0 },
  error: { fontSize: 12, color: '#EF4444', marginTop: 8 },
  btn: {
    marginTop: 16,
    backgroundColor: palette.blue[50],
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    ...shadows.blue,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
