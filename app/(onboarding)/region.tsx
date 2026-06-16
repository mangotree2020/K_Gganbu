import { router } from 'expo-router'
import { Text, TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/brand'
import { OnboardingShell } from '@/features/onboarding/Shell'
import { useOnboardingStore, type RegionId } from '@/features/onboarding/store'
import { palette } from '@/theme/tokens'

const REGIONS: { id: RegionId; name: string; emoji: string; sub: string }[] = [
  { id: 'busan', name: 'Busan', emoji: '🌊', sub: 'Beaches · seafood · cruise port' },
  { id: 'seoul', name: 'Seoul', emoji: '🏙️', sub: 'Palaces · shopping · K-culture' },
  { id: 'jeju', name: 'Jeju', emoji: '🍊', sub: 'Island · nature · hiking' },
  { id: 'gyeongju', name: 'Gyeongju', emoji: '🏯', sub: 'History · temples · heritage' },
  { id: 'incheon', name: 'Incheon', emoji: '✈️', sub: 'Airport · Chinatown · port' },
  { id: 'other', name: 'Somewhere else', emoji: '🧭', sub: "I'll decide later" },
]

export default function OnboardingRegion() {
  const region = useOnboardingStore((s) => s.region)
  const setRegion = useOnboardingStore((s) => s.setRegion)

  return (
    <OnboardingShell
      step={2}
      total={3}
      title="Where are you headed?"
      subtitle="여행 지역을 선택하면 맞춤 추천을 받을 수 있어요."
      ctaLabel="Continue"
      ctaDisabled={!region}
      onBack={() => router.back()}
      onNext={() => router.push('/(onboarding)/interests')}>
      <View style={{ gap: 10 }}>
        {REGIONS.map((r) => {
          const active = r.id === region
          return (
            <TouchableOpacity
              key={r.id}
              activeOpacity={0.7}
              onPress={() => setRegion(r.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 16,
                borderWidth: active ? 2 : 1,
                borderColor: active ? palette.blue[50] : palette.zinc[200],
                backgroundColor: active ? palette.blue[95] : '#fff',
              }}>
              <Text style={{ fontSize: 26 }}>{r.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: active ? '800' : '700',
                    color: active ? palette.blue[30] : palette.zinc[900],
                  }}>
                  {r.name}
                </Text>
                <Text style={{ fontSize: 11.5, color: palette.zinc[500], marginTop: 1 }}>
                  {r.sub}
                </Text>
              </View>
              {active && <Icon name="check_circle" size={22} color={palette.blue[50]} filled />}
            </TouchableOpacity>
          )
        })}
      </View>
    </OnboardingShell>
  )
}
