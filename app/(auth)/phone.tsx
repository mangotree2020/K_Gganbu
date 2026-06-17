import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { useSendOtp, useVerifyOtp } from '@/features/auth/queries'
import { palette, shadows } from '@/theme/tokens'

// 인바운드 주 타깃 국가 우선 (PLANNING §4: 중국·대만·일본 FIT)
const COUNTRY_CODES = [
  { flag: '🇰🇷', code: '+82', name: 'Korea' },
  { flag: '🇯🇵', code: '+81', name: 'Japan' },
  { flag: '🇨🇳', code: '+86', name: 'China' },
  { flag: '🇹🇼', code: '+886', name: 'Taiwan' },
  { flag: '🇭🇰', code: '+852', name: 'Hong Kong' },
  { flag: '🇺🇸', code: '+1', name: 'USA / Canada' },
  { flag: '🇬🇧', code: '+44', name: 'United Kingdom' },
  { flag: '🇻🇳', code: '+84', name: 'Vietnam' },
  { flag: '🇹🇭', code: '+66', name: 'Thailand' },
  { flag: '🇮🇩', code: '+62', name: 'Indonesia' },
  { flag: '🇸🇬', code: '+65', name: 'Singapore' },
]

const RESEND_SECONDS = 60

// Supabase OTP 오류 → 사용자 친화 안내 (만료/불일치/한도/네트워크)
function friendlyOtpError(err: unknown): string {
  const m = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase()
  if (m.includes('expired')) return 'This code has expired. Tap Resend to get a new one.'
  if (m.includes('invalid') || m.includes('token') || m.includes('incorrect'))
    return 'That code didn’t match. Please check and try again.'
  if (m.includes('rate') || m.includes('limit') || m.includes('too many') || m.includes('429'))
    return 'Too many attempts. Please wait a moment and try again.'
  if (m.includes('network') || m.includes('fetch') || m.includes('connection'))
    return 'Network issue. Check your connection and try again.'
  return 'Something went wrong. Please try again.'
}

export default function PhoneScreen() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [country, setCountry] = useState(COUNTRY_CODES[0])
  const [ccOpen, setCcOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState('')
  const [cooldown, setCooldown] = useState(0)

  const send = useSendOtp()
  const verify = useVerifyOtp()

  // 재발송 쿨다운 카운트다운
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  // 국내(0) 트렁크 제거 + 국가코드 결합 → E.164
  const normalized = () => `${country.code}${phone.replace(/[^0-9]/g, '').replace(/^0/, '')}`

  const onSend = () => {
    send.reset()
    send.mutate(
      { phone: normalized() },
      {
        onSuccess: () => {
          setStep('otp')
          setCooldown(RESEND_SECONDS)
        },
      },
    )
  }

  const onResend = () => {
    if (cooldown > 0) return
    setToken('')
    verify.reset()
    send.reset()
    send.mutate({ phone: normalized() }, { onSuccess: () => setCooldown(RESEND_SECONDS) })
  }

  const onVerify = () => verify.mutate({ phone: normalized(), token })

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
            : `Sent to ${country.code} ${phone}. Enter the 6-digit code.`}
        </Text>

        {step === 'phone' ? (
          <>
            <View style={ss.field}>
              <Pressable onPress={() => setCcOpen(true)} style={ss.ccBtn}>
                <Text style={ss.cc}>
                  {country.flag} {country.code}
                </Text>
                <Icon name="expand_more" size={16} color={palette.zinc[500]} />
              </Pressable>
              <View style={ss.divider} />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="10-1234-5678"
                placeholderTextColor={palette.zinc[400]}
                keyboardType="phone-pad"
                style={ss.input}
              />
            </View>
            {!!send.error && <Text style={ss.error}>{friendlyOtpError(send.error)}</Text>}
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
            {!!verify.error && <Text style={ss.error}>{friendlyOtpError(verify.error)}</Text>}
            <Pressable
              onPress={onVerify}
              disabled={verify.isPending || token.length < 6}
              style={[ss.btn, { opacity: verify.isPending || token.length < 6 ? 0.6 : 1 }]}>
              <Text style={ss.btnText}>
                {verify.isPending ? 'Verifying…' : 'Verify & continue'}
              </Text>
            </Pressable>

            <View style={ss.otpFooter}>
              <Pressable onPress={() => setStep('phone')}>
                <Text style={ss.linkText}>Change number</Text>
              </Pressable>
              <Pressable onPress={onResend} disabled={cooldown > 0 || send.isPending}>
                <Text style={[ss.linkText, cooldown > 0 && ss.linkDisabled]}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      {/* 국가코드 선택 */}
      <Modal
        visible={ccOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCcOpen(false)}>
        <Pressable style={ss.ccBackdrop} onPress={() => setCcOpen(false)} />
        <View style={[ss.ccSheet, shadows.pop]}>
          <View style={ss.grabber} />
          <Text style={ss.ccTitle}>Select country code</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {COUNTRY_CODES.map((c) => {
              const on = c.code === country.code && c.name === country.name
              return (
                <Pressable
                  key={c.name}
                  onPress={() => {
                    setCountry(c)
                    setCcOpen(false)
                  }}
                  style={({ pressed }) => [ss.ccRow, { opacity: pressed ? 0.7 : 1 }]}>
                  <Text style={ss.ccFlag}>{c.flag}</Text>
                  <Text style={ss.ccName}>{c.name}</Text>
                  <Text style={ss.ccCode}>{c.code}</Text>
                  {on && <Icon name="check" size={18} color={palette.blue[50]} />}
                </Pressable>
              )
            })}
          </ScrollView>
        </View>
      </Modal>
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
  ccBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  divider: { width: 1, height: 24, backgroundColor: palette.zinc[200] },
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
  otpFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  linkText: { fontSize: 13, color: palette.blue[50], fontWeight: '600' },
  linkDisabled: { color: palette.zinc[400] },
  ccBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)' },
  ccSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.zinc[200],
    alignSelf: 'center',
    marginBottom: 14,
  },
  ccTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.zinc[900],
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  ccRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.zinc[100],
  },
  ccFlag: { fontSize: 22 },
  ccName: { flex: 1, fontSize: 15, fontWeight: '600', color: palette.zinc[900] },
  ccCode: { fontSize: 14, fontWeight: '700', color: palette.zinc[500] },
})
