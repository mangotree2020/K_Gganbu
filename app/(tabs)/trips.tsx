import { Plus } from 'lucide-react-native'
import { FlatList, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useTrips } from '@/features/trips/queries'
import { TripCard } from '@/components/shared/TripCard'

export default function TripsScreen() {
  const { data: trips, isLoading } = useTrips()

  return (
    <SafeAreaView className='flex-1 bg-white'>
      <View className='flex-row items-center justify-between px-4 pt-4 pb-3'>
        <Text className='text-2xl font-bold text-gray-900'>내 여행</Text>
        <TouchableOpacity className='bg-blue-600 rounded-full p-2'>
          <Plus size={20} color='#FFFFFF' />
        </TouchableOpacity>
      </View>

      <FlatList
        data={trips ?? []}
        keyExtractor={(item) => item.id}
        contentContainerClassName='px-4 pb-8'
        ListEmptyComponent={
          <View className='items-center py-12 gap-3'>
            {isLoading ? (
              <Text className='text-gray-400'>불러오는 중...</Text>
            ) : (
              <>
                <Text className='text-gray-400 text-center'>
                  아직 여행이 없습니다.{'\n'}첫 여행을 계획해 보세요!
                </Text>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => <TripCard trip={item} />}
      />
    </SafeAreaView>
  )
}
