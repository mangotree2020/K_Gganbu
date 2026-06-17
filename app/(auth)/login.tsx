import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Lock, Mail, MessageSquare } from 'lucide-react-native'
import { useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text as RNText,
  TouchableOpacity,
  View,
} from 'react-native'
import { Link, router } from 'expo-router'
import Svg, { Path } from 'react-native-svg'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BrandMark } from '@/components/brand'
import { Input } from '@/components/ui/input'
import { useOAuthSignIn, useSignIn } from '@/features/auth/queries'
import { loginSchema, type LoginFormData } from '@/features/auth/types'

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        fill="#4285F4"
        d="M17.64 9.2c0-.638-.057-1.252-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908C16.658 14.38 17.64 12.07 17.64 9.2z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.97 0 5.46-.98 7.28-2.66l-2.908-2.258c-.98.66-2.23 1.05-3.372 1.05-2.59 0-4.786-1.75-5.57-4.1H.43v2.33A9 9 0 0 0 9 18z"
      />
      <Path
        fill="#FBBC05"
        d="M3.43 10.032a5.4 5.4 0 0 1 0-3.444V4.258H.43A9 9 0 0 0 0 9c0 1.452.348 2.826.43 4.03l3-3z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.58c1.458 0 2.77.5 3.8 1.48l2.85-2.85C13.95.48 11.67 0 9 0A9 9 0 0 0 .43 4.258l3 2.33C4.214 4.63 6.41 3.58 9 3.58z"
      />
    </Svg>
  )
}

function AppleIcon({ color = '#18181B' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
      />
    </Svg>
  )
}

type SocialBtnProps = {
  bg: string
  textColor: string
  borderColor?: string
  icon: React.ReactNode
  label: string
  onPress?: () => void
}

function SocialBtn({ bg, textColor, borderColor, icon, label, onPress }: SocialBtnProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        height: 48,
        borderRadius: 14,
        backgroundColor: bg,
        borderWidth: borderColor ? 1 : 0,
        borderColor: borderColor,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
      }}>
      <View style={{ width: 36, alignItems: 'flex-start', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <RNText style={{ fontSize: 15, fontWeight: '600', color: textColor }}>{label}</RNText>
      </View>
      <View style={{ width: 36 }} />
    </TouchableOpacity>
  )
}

export default function LoginScreen() {
  const { mutate: signIn, isPending, error } = useSignIn()
  const { mutate: oauthSignIn, error: oauthError } = useOAuthSignIn()
  const [showPassword, setShowPassword] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)
  }

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#fff' }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}>
        {/* 헤더 */}
        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 2 }}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#E4E4E7',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              opacity: pressed ? 0.6 : 1,
            })}>
            <RNText style={{ fontSize: 18, color: '#18181B', lineHeight: 22 }}>←</RNText>
          </Pressable>

          <BrandMark size={42} />
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
          {/* 웰컴 텍스트 */}
          <View style={{ gap: 4, marginBottom: 24 }}>
            <RNText
              style={{ fontSize: 26, fontWeight: '700', color: '#18181B', letterSpacing: -0.5 }}>
              Welcome back 👋
            </RNText>
            <RNText style={{ fontSize: 14, color: '#71717A', lineHeight: 20 }}>
              Log in to pick up where you left off in Busan.
            </RNText>
          </View>

          {/* 소셜 로그인 버튼 */}
          <View style={{ gap: 10, marginBottom: 16 }}>
            <SocialBtn
              bg="#fff"
              textColor="#18181B"
              borderColor="#E4E4E7"
              icon={<GoogleIcon />}
              label="Continue with Google"
              onPress={() => oauthSignIn('google')}
            />
            <SocialBtn
              bg="#000"
              textColor="#fff"
              icon={<AppleIcon color="#fff" />}
              label="Continue with Apple"
              onPress={() => oauthSignIn('apple')}
            />
            <SocialBtn
              bg="#0EA5E9"
              textColor="#fff"
              icon={<MessageSquare size={18} color="#fff" />}
              label="Continue with phone (OTP)"
              onPress={() => router.push('/(auth)/phone')}
            />
            <SocialBtn
              bg="#06C755"
              textColor="#fff"
              icon={
                <View
                  style={{
                    borderWidth: 1.5,
                    borderColor: '#fff',
                    borderRadius: 4,
                    paddingHorizontal: 5,
                    paddingVertical: 3,
                  }}>
                  <RNText
                    numberOfLines={1}
                    style={{ color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0 }}>
                    LINE
                  </RNText>
                </View>
              }
              label="Continue with LINE"
              onPress={() =>
                Alert.alert(
                  'LINE login',
                  'Coming in Phase 2. Please use Google, Apple, or phone for now.',
                )
              }
            />
          </View>

          {/* Phone OTP 안내 */}
          <View
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 20 }}>
            <RNText style={{ fontSize: 11, color: '#71717A' }}>🛡</RNText>
            <RNText style={{ fontSize: 11, color: '#71717A', flex: 1, lineHeight: 16 }}>
              Phone OTP works with your home number — no Korean SIM needed
            </RNText>
          </View>

          {oauthError && (
            <RNText
              style={{ fontSize: 12, color: '#EF4444', textAlign: 'center', marginBottom: 12 }}>
              {oauthError.message}
            </RNText>
          )}

          {/* Use email instead 토글 */}
          <TouchableOpacity
            testID="email-toggle"
            onPress={() => {
              setShowEmailForm((v) => !v)
              if (!showEmailForm) scrollToBottom()
            }}
            activeOpacity={0.7}
            style={{ alignItems: 'center', marginBottom: showEmailForm ? 16 : 0 }}>
            <RNText style={{ fontSize: 14, color: '#3F3F46', fontWeight: '500' }}>
              Use email instead {showEmailForm ? '↑' : '↓'}
            </RNText>
          </TouchableOpacity>

          {/* 이메일 폼 (토글) */}
          {showEmailForm && (
            <View>
              {/* 이메일 입력 */}
              <View style={{ marginBottom: 12 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    height: 52,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#E4E4E7',
                    backgroundColor: '#F4F4F5',
                    paddingHorizontal: 14,
                    gap: 10,
                  }}>
                  <Mail size={18} color="#71717A" />
                  <Controller
                    control={control}
                    name="email"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        testID="email-input"
                        placeholder="Email Address"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="off"
                        autoCorrect={false}
                        importantForAutofill="no"
                        returnKeyType="next"
                        onFocus={scrollToBottom}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        style={{
                          flex: 1,
                          height: 50,
                          fontSize: 15,
                          borderWidth: 0,
                          backgroundColor: 'transparent',
                          paddingHorizontal: 0,
                          shadowOpacity: 0,
                        }}
                      />
                    )}
                  />
                </View>
                {errors.email && (
                  <RNText style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>
                    {errors.email.message}
                  </RNText>
                )}
              </View>

              {/* 비밀번호 입력 */}
              <View style={{ marginBottom: 8 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    height: 52,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#E4E4E7',
                    backgroundColor: '#F4F4F5',
                    paddingHorizontal: 14,
                    gap: 10,
                  }}>
                  <Lock size={18} color="#71717A" />
                  <Controller
                    control={control}
                    name="password"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        testID="password-input"
                        secureTextEntry={!showPassword}
                        placeholder="Password"
                        autoComplete="off"
                        importantForAutofill="no"
                        returnKeyType="send"
                        onFocus={scrollToBottom}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                        onSubmitEditing={handleSubmit((data) => signIn(data))}
                        style={{
                          flex: 1,
                          height: 50,
                          fontSize: 15,
                          borderWidth: 0,
                          backgroundColor: 'transparent',
                          paddingHorizontal: 0,
                          shadowOpacity: 0,
                          color: '#3F3F46',
                        }}
                      />
                    )}
                  />
                  <Pressable onPress={() => setShowPassword((v) => !v)} style={{ padding: 4 }}>
                    {showPassword ? (
                      <Eye size={18} color="#71717A" />
                    ) : (
                      <EyeOff size={18} color="#71717A" />
                    )}
                  </Pressable>
                </View>
                {errors.password && (
                  <RNText style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>
                    {errors.password.message}
                  </RNText>
                )}
              </View>

              {/* Forgot password */}
              <View style={{ alignItems: 'flex-end', marginBottom: 20 }}>
                <Pressable>
                  <RNText style={{ fontSize: 13, color: '#0EA5E9', fontWeight: '500' }}>
                    Forgot password?
                  </RNText>
                </Pressable>
              </View>

              {error && (
                <RNText
                  style={{ fontSize: 13, color: '#EF4444', textAlign: 'center', marginBottom: 12 }}>
                  {error.message}
                </RNText>
              )}

              {/* 로그인 버튼 */}
              <TouchableOpacity
                testID="login-button"
                onPress={handleSubmit((data) => signIn(data))}
                disabled={isPending}
                activeOpacity={0.82}
                style={{
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: isPending ? '#0284C7' : '#0EA5E9',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}>
                <RNText style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                  {isPending ? 'Logging in...' : 'Log in'}
                </RNText>
              </TouchableOpacity>
            </View>
          )}

          {/* 회원가입 링크 */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 4,
              marginTop: showEmailForm ? 0 : 20,
              marginBottom: 16,
            }}>
            <RNText style={{ fontSize: 14, color: '#71717A' }}>New to K-Gganbu?</RNText>
            <Link href="/(auth)/register" asChild>
              <Pressable>
                <RNText style={{ fontSize: 14, color: '#0EA5E9', fontWeight: '600' }}>
                  Create account
                </RNText>
              </Pressable>
            </Link>
          </View>

          {/* 약관 푸터 */}
          <View
            style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 3 }}>
            <RNText style={{ fontSize: 12, color: '#A1A1AA' }}>
              By continuing you agree to our
            </RNText>
            <Pressable>
              <RNText style={{ fontSize: 12, color: '#71717A', fontWeight: '600' }}>Terms</RNText>
            </Pressable>
            <RNText style={{ fontSize: 12, color: '#A1A1AA' }}> & </RNText>
            <Pressable>
              <RNText style={{ fontSize: 12, color: '#71717A', fontWeight: '600' }}>
                Privacy Policy
              </RNText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
