import { router } from 'expo-router'
import { Text, TouchableOpacity, View } from 'react-native'

import { OnboardingShell } from '@/features/onboarding/Shell'
import { useOnboardingStore, type InterestId } from '@/features/onboarding/store'
import { palette } from '@/theme/tokens'

const INTERESTS: { id: InterestId; label: string; emoji: string }[] = [
  { id: 'food', label: 'Food', emoji: '🍜' },
  { id: 'kculture', label: 'K-Culture', emoji: '🎤' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'nature', label: 'Nature', emoji: '🏞️' },
  { id: 'cruise', label: 'Cruise', emoji: '🛳️' },
  { id: 'history', label: 'History', emoji: '🏯' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🌃' },
  { id: 'photo', label: 'Photo spots', emoji: '📸' },
]

export default function OnboardingInterests() {
  const interests = useOnboardingStore((s) => s.interests)
  const toggleInterest = useOnboardingStore((s) => s.toggleInterest)
  const complete = useOnboardingStore((s) => s.complete)

  const finish = () => {
    complete()
    router.replace('/(tabs)')
  }

  return (
    <OnboardingShell
      step={3}
      total={3}
      title="What do you love?"
      subtitle="관심사를 골라주세요 (여러 개 선택 가능). AI 깐부가 맞춤 추천에 활용해요."
      ctaLabel={interests.length > 0 ? `Start exploring (${interests.length})` : 'Skip for now'}
      onBack={() => router.back()}
      onNext={finish}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {INTERESTS.map((it) => {
          const active = interests.includes(it.id)
          return (
            <TouchableOpacity
              key={it.id}
              activeOpacity={0.7}
              onPress={() => toggleInterest(it.id)}
              style={{
                width: '47%',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 16,
                paddingHorizontal: 14,
                borderRadius: 16,
                borderWidth: active ? 2 : 1,
                borderColor: active ? palette.teal[40] : palette.zinc[200],
                backgroundColor: active ? palette.teal[95] : '#fff',
              }}>
              <Text style={{ fontSize: 22 }}>{it.emoji}</Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: active ? '800' : '600',
                  color: active ? palette.teal[30] : palette.zinc[800],
                }}>
                {it.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </OnboardingShell>
  )
}
