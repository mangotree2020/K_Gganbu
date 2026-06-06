import { Calendar, MapPin } from 'lucide-react-native'
import { Text, TouchableOpacity, View } from 'react-native'

import { formatDate } from '@/utils/format'
import type { Trip } from '@/features/trips/types'

interface TripCardProps {
  trip: Trip
  onPress?: () => void
}

export function TripCard({ trip, onPress }: TripCardProps) {
  return (
    <TouchableOpacity
      className='bg-white rounded-xl border border-gray-100 p-4 mb-3 shadow-sm'
      onPress={onPress}
      activeOpacity={0.7}>
      <Text className='text-base font-semibold text-gray-900 mb-2'>{trip.title}</Text>

      <View className='flex-row items-center gap-1 mb-1'>
        <MapPin size={14} color='#94A3B8' />
        <Text className='text-sm text-gray-500'>{trip.destination}</Text>
      </View>

      <View className='flex-row items-center gap-1'>
        <Calendar size={14} color='#94A3B8' />
        <Text className='text-sm text-gray-500'>
          {formatDate(trip.startDate)} ~ {formatDate(trip.endDate)}
        </Text>
      </View>

      {trip.description && (
        <Text className='text-sm text-gray-600 mt-2' numberOfLines={2}>
          {trip.description}
        </Text>
      )}
    </TouchableOpacity>
  )
}
