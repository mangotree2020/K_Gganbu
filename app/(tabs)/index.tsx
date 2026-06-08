import { router } from 'expo-router'
import { MapPin } from 'lucide-react-native'
import { Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { useAuthStore } from '@/features/auth/store'
import { useDestinations } from '@/features/destinations/queries'

function SkeletonCard() {
  return <View className="bg-muted rounded-xl h-24 mb-3 animate-pulse" />
}

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user)
  const { data, isLoading } = useDestinations()
  const destinations = data?.pages.flat() ?? []

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-4 pb-8">
        <View className="pt-6 pb-4 gap-1">
          <Text variant="h3">안녕하세요, {user?.fullName ?? '여행자'}님</Text>
          <Text variant="muted">오늘은 어디로 떠나볼까요?</Text>
        </View>

        <View className="flex-row gap-3 mb-6">
          <Button className="flex-1" onPress={() => router.push('/(tabs)/trips')}>
            <Text>새 여행 계획</Text>
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            onPress={() => router.push('/(tabs)/explore')}>
            <Text>여행지 탐색</Text>
          </Button>
        </View>

        <Text variant="large" className="mb-3">
          추천 여행지
        </Text>

        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : destinations.length === 0 ? (
          <View className="items-center py-12 gap-3">
            <MapPin size={48} color="#94A3B8" />
            <Text variant="muted" className="text-center">
              여행지 데이터를 준비 중입니다
            </Text>
          </View>
        ) : (
          destinations.map((dest) => (
            <Pressable key={dest.id} className="mb-3 active:opacity-80">
              <Card className="py-0">
                <CardHeader className="py-4">
                  <CardTitle>{dest.name}</CardTitle>
                  <CardDescription>{dest.country}</CardDescription>
                </CardHeader>
                {dest.description && (
                  <CardContent className="pb-4 pt-0">
                    <Text variant="muted" numberOfLines={2}>
                      {dest.description}
                    </Text>
                  </CardContent>
                )}
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
