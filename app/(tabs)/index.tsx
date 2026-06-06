import { MapPin } from 'lucide-react-native'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuthStore } from '@/features/auth/store'
import { useDestinations } from '@/features/destinations/queries'

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user)
  const { data, isLoading } = useDestinations()
  const destinations = data?.pages.flat() ?? []

  return (
    <SafeAreaView className='flex-1 bg-white'>
      <ScrollView contentContainerClassName='px-4 pb-8'>
        <View className='pt-4 pb-6'>
          <Text className='text-2xl font-bold text-gray-900'>
            안녕하세요, {user?.fullName ?? '여행자'}님
          </Text>
          <Text className='text-gray-500 mt-1'>오늘은 어디로 떠나볼까요?</Text>
        </View>

        <Text className='text-lg font-semibold text-gray-900 mb-3'>추천 여행지</Text>

        {isLoading ? (
          <Text className='text-gray-400 text-center py-8'>불러오는 중...</Text>
        ) : destinations.length === 0 ? (
          <View className='items-center py-12 gap-3'>
            <MapPin size={48} color='#94A3B8' />
            <Text className='text-gray-400 text-center'>여행지 데이터를 준비 중입니다</Text>
          </View>
        ) : (
          destinations.map((dest) => (
            <View
              key={dest.id}
              className='bg-gray-50 rounded-xl p-4 mb-3 border border-gray-100'>
              <Text className='text-base font-semibold text-gray-900'>{dest.name}</Text>
              <Text className='text-sm text-gray-500 mt-1'>{dest.country}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
