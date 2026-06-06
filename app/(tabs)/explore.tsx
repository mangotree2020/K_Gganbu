import { Search } from 'lucide-react-native'
import { useState } from 'react'
import { FlatList, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useDestinations } from '@/features/destinations/queries'

export default function ExploreScreen() {
  const [search, setSearch] = useState('')
  const { data, isLoading } = useDestinations(search || undefined)
  const destinations = data?.pages.flat() ?? []

  return (
    <SafeAreaView className='flex-1 bg-white'>
      <View className='px-4 pt-4 pb-3'>
        <Text className='text-2xl font-bold text-gray-900 mb-4'>여행지 탐색</Text>
        <View className='flex-row items-center border border-gray-300 rounded-xl px-4 py-3 gap-3 bg-gray-50'>
          <Search size={18} color='#94A3B8' />
          <TextInput
            className='flex-1 text-gray-900'
            placeholder='도시 또는 국가 검색'
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <FlatList
        data={destinations}
        keyExtractor={(item) => item.id}
        contentContainerClassName='px-4 pb-8'
        ListEmptyComponent={
          <View className='items-center py-12'>
            <Text className='text-gray-400'>
              {isLoading ? '검색 중...' : '검색 결과가 없습니다'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className='bg-white rounded-xl border border-gray-100 p-4 mb-3 shadow-sm'>
            <Text className='font-semibold text-gray-900'>{item.name}</Text>
            <Text className='text-sm text-gray-500 mt-0.5'>{item.country}</Text>
            {item.description && (
              <Text className='text-sm text-gray-600 mt-2' numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  )
}
