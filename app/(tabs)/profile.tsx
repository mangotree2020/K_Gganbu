import { ChevronRight, LogOut, User } from 'lucide-react-native'
import { Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useSignOut } from '@/features/auth/queries'
import { useAuthStore } from '@/features/auth/store'

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user)
  const { mutate: signOut, isPending } = useSignOut()

  return (
    <SafeAreaView className='flex-1 bg-white'>
      <View className='px-4 pt-4'>
        <Text className='text-2xl font-bold text-gray-900 mb-6'>프로필</Text>

        <View className='items-center mb-8'>
          <View className='w-20 h-20 rounded-full bg-blue-100 items-center justify-center mb-3'>
            <User size={40} color='#2563EB' />
          </View>
          <Text className='text-lg font-semibold text-gray-900'>{user?.fullName ?? '사용자'}</Text>
          <Text className='text-gray-500 mt-1'>{user?.email}</Text>
        </View>

        <View className='gap-2'>
          <TouchableOpacity className='flex-row items-center justify-between py-4 border-b border-gray-100'>
            <Text className='text-base text-gray-900'>계정 설정</Text>
            <ChevronRight size={18} color='#94A3B8' />
          </TouchableOpacity>

          <TouchableOpacity className='flex-row items-center justify-between py-4 border-b border-gray-100'>
            <Text className='text-base text-gray-900'>알림 설정</Text>
            <ChevronRight size={18} color='#94A3B8' />
          </TouchableOpacity>

          <TouchableOpacity className='flex-row items-center justify-between py-4 border-b border-gray-100'>
            <Text className='text-base text-gray-900'>도움말</Text>
            <ChevronRight size={18} color='#94A3B8' />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          className='flex-row items-center justify-center gap-2 mt-8 py-4 rounded-xl border border-red-200 bg-red-50'
          onPress={() => signOut()}
          disabled={isPending}>
          <LogOut size={18} color='#EF4444' />
          <Text className='text-red-500 font-medium'>{isPending ? '로그아웃 중...' : '로그아웃'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
