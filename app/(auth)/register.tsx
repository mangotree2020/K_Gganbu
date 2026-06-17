import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react-native'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Link, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BrandMark, Icon } from '@/components/brand'
import { useSignUp } from '@/features/auth/queries'
import { registerSchema, type RegisterFormData } from '@/features/auth/types'
import { palette, shadows } from '@/theme/tokens'

type FieldProps = {
  icon: React.ReactNode
  trailing?: React.ReactNode
  error?: string
} & React.ComponentProps<typeof TextInput>

// 아이콘 + 보더 입력 박스 (login.tsx와 동일 톤). NativeWind 미사용 — StyleSheet 기반.
function Field({ icon, trailing, error, ...props }: FieldProps) {
  return (
    <View>
      <View style={[ss.field, error ? ss.fieldError : null]}>
        {icon}
        <TextInput
          placeholderTextColor={palette.zinc[400]}
          style={ss.input}
          autoCorrect={false}
          {...props}
        />
        {trailing}
      </View>
      {!!error && <Text style={ss.errorText}>{error}</Text>}
    </View>
  )
}

export default function RegisterScreen() {
  const { mutate: signUp, isPending, error } = useSignUp()
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) })

  const onSubmit = handleSubmit((data) => signUp(data))

  return (
    <SafeAreaView style={ss.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* 헤더 */}
        <View style={ss.header}>
          <Pressable onPress={() => router.back()} style={ss.back}>
            <Icon name="arrow_back" size={20} color={palette.zinc[700]} />
          </Pressable>
          <BrandMark size={42} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
          <View style={{ marginBottom: 22 }}>
            <Text style={ss.title}>Create account</Text>
            <Text style={ss.subtitle}>Join K-Gganbu and start exploring Busan.</Text>
          </View>

          <View style={{ gap: 14 }}>
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  icon={<User size={18} color={palette.zinc[500]} />}
                  placeholder="Full name"
                  autoComplete="name"
                  returnKeyType="next"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  error={errors.fullName?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  icon={<Mail size={18} color={palette.zinc[500]} />}
                  placeholder="Email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  returnKeyType="next"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  error={errors.email?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  icon={<Lock size={18} color={palette.zinc[500]} />}
                  placeholder="Password (8+ characters)"
                  secureTextEntry={!showPw}
                  returnKeyType="next"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  error={errors.password?.message}
                  trailing={
                    <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                      {showPw ? (
                        <EyeOff size={18} color={palette.zinc[400]} />
                      ) : (
                        <Eye size={18} color={palette.zinc[400]} />
                      )}
                    </Pressable>
                  }
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Field
                  icon={<Lock size={18} color={palette.zinc[500]} />}
                  placeholder="Confirm password"
                  secureTextEntry={!showPw2}
                  returnKeyType="send"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  onSubmitEditing={onSubmit}
                  error={errors.confirmPassword?.message}
                  trailing={
                    <Pressable onPress={() => setShowPw2((v) => !v)} hitSlop={8}>
                      {showPw2 ? (
                        <EyeOff size={18} color={palette.zinc[400]} />
                      ) : (
                        <Eye size={18} color={palette.zinc[400]} />
                      )}
                    </Pressable>
                  }
                />
              )}
            />

            {!!error && <Text style={ss.formError}>{error.message}</Text>}

            {/* 카드형 Pressable은 plain 배열 style 사용 (CLAUDE.md: 함수형 style 간헐 미적용) */}
            <Pressable
              onPress={onSubmit}
              disabled={isPending}
              style={[ss.cta, isPending && { opacity: 0.85 }]}>
              <Text style={ss.ctaText}>{isPending ? 'Creating…' : 'Create account'}</Text>
            </Pressable>
          </View>

          <View style={ss.footer}>
            <Text style={ss.footerText}>Already have an account?</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable hitSlop={6}>
                <Text style={ss.footerLink}>Log in</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 2, gap: 16 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.zinc[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 26, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: palette.zinc[500], marginTop: 6, lineHeight: 20 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.zinc[200],
    backgroundColor: palette.zinc[50],
    paddingHorizontal: 14,
  },
  fieldError: { borderColor: palette.error[50] },
  input: { flex: 1, fontSize: 15, color: palette.zinc[900], padding: 0 },
  errorText: { fontSize: 11, color: palette.error[50], marginTop: 5, marginLeft: 2 },
  formError: { fontSize: 12, color: palette.error[50], textAlign: 'center' },
  cta: {
    marginTop: 4,
    backgroundColor: palette.coral[50],
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    ...shadows.card,
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 22 },
  footerText: { fontSize: 13, color: palette.zinc[500] },
  footerLink: { fontSize: 13, fontWeight: '700', color: palette.blue[50] },
})
