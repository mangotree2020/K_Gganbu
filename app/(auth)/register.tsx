import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { useSignUp } from '@/features/auth/queries'
import { registerSchema, type RegisterFormData } from '@/features/auth/types'

export default function RegisterScreen() {
  const { mutate: signUp, isPending, error } = useSignUp()
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  return (
    <SafeAreaView className='flex-1' style={{ backgroundColor: '#0EA5E9' }} edges={['top']}>
      <KeyboardAvoidingView
        className='flex-1'
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* 상단 헤더 */}
        <View className='items-center justify-center py-10 gap-2'>
          <Text
            className='text-white font-bold'
            style={{ fontSize: 28, fontWeight: '800' }}>
            K-Gganbu
          </Text>
          <Text className='text-white/80 text-sm'>새 계정을 만들어보세요</Text>
        </View>

        {/* 폼 카드 */}
        <View
          className='flex-1 bg-white px-6 pt-8'
          style={{ borderTopLeftRadius: 32, borderTopRightRadius: 32 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps='handled'
            contentContainerClassName='gap-6 pb-12'>

            <View className='gap-1'>
              <Text className='text-2xl font-bold text-foreground'>회원가입</Text>
              <Text className='text-muted-foreground text-sm'>아래 정보를 입력해 계정을 만드세요</Text>
            </View>

            <View className='gap-4'>
              <View className='gap-1.5'>
                <Text className='text-sm font-medium text-foreground'>이름</Text>
                <Controller
                  control={control}
                  name='fullName'
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      placeholder='홍길동'
                      autoComplete='name'
                      returnKeyType='next'
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                  )}
                />
                {errors.fullName && (
                  <Text className='text-destructive text-xs'>{errors.fullName.message}</Text>
                )}
              </View>

              <View className='gap-1.5'>
                <Text className='text-sm font-medium text-foreground'>이메일</Text>
                <Controller
                  control={control}
                  name='email'
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      placeholder='your@email.com'
                      keyboardType='email-address'
                      autoCapitalize='none'
                      autoComplete='email'
                      returnKeyType='next'
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                  )}
                />
                {errors.email && (
                  <Text className='text-destructive text-xs'>{errors.email.message}</Text>
                )}
              </View>

              <View className='gap-1.5'>
                <Text className='text-sm font-medium text-foreground'>비밀번호</Text>
                <Controller
                  control={control}
                  name='password'
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      secureTextEntry
                      placeholder='8자 이상'
                      returnKeyType='next'
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                  )}
                />
                {errors.password && (
                  <Text className='text-destructive text-xs'>{errors.password.message}</Text>
                )}
              </View>

              <View className='gap-1.5'>
                <Text className='text-sm font-medium text-foreground'>비밀번호 확인</Text>
                <Controller
                  control={control}
                  name='confirmPassword'
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      secureTextEntry
                      placeholder='비밀번호 재입력'
                      returnKeyType='send'
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      onSubmitEditing={handleSubmit((data) => signUp(data))}
                    />
                  )}
                />
                {errors.confirmPassword && (
                  <Text className='text-destructive text-xs'>{errors.confirmPassword.message}</Text>
                )}
              </View>

              {error && (
                <Text className='text-destructive text-center text-sm'>{error.message}</Text>
              )}

              <Pressable
                onPress={handleSubmit((data) => signUp(data))}
                disabled={isPending}
                className='items-center justify-center rounded-xl py-4'
                style={{ backgroundColor: '#F97316' }}>
                <Text className='text-white font-bold text-base'>
                  {isPending ? '가입 중...' : '회원가입'}
                </Text>
              </Pressable>
            </View>

            <View className='flex-row justify-center gap-1'>
              <Text className='text-muted-foreground text-sm'>이미 계정이 있으신가요?</Text>
              <Link href='/(auth)/login' asChild>
                <Pressable>
                  <Text className='font-semibold text-sm' style={{ color: '#0EA5E9' }}>
                    로그인
                  </Text>
                </Pressable>
              </Link>
            </View>

          </ScrollView>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
