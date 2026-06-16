import { router } from 'expo-router'
import { Text, TouchableOpacity, View } from 'react-native'

import { Icon } from '@/components/brand'
import { OnboardingShell } from '@/features/onboarding/Shell'
import { APP_LANGS, useLocaleStore, type AppLang } from '@/lib/i18n'
import { palette } from '@/theme/tokens'

export default function OnboardingLanguage() {
  const lang = useLocaleStore((s) => s.lang)
  const setLang = useLocaleStore((s) => s.setLang)

  return (
    <OnboardingShell
      step={1}
      total={3}
      title="Choose your language"
      subtitle="앱과 번역에 사용할 언어를 골라주세요."
      ctaLabel="Continue"
      onNext={() => router.push('/(onboarding)/region')}>
      <View style={{ gap: 10 }}>
        {APP_LANGS.map((l) => {
          const active = l.code === lang
          return (
            <TouchableOpacity
              key={l.code}
              activeOpacity={0.7}
              onPress={() => setLang(l.code as AppLang)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderRadius: 16,
                borderWidth: active ? 2 : 1,
                borderColor: active ? palette.blue[50] : palette.zinc[200],
                backgroundColor: active ? palette.blue[95] : '#fff',
              }}>
              <Text style={{ fontSize: 26 }}>{l.flag}</Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: active ? '800' : '600',
                  color: active ? palette.blue[30] : palette.zinc[800],
                }}>
                {l.label}
              </Text>
              {active && <Icon name="check_circle" size={22} color={palette.blue[50]} filled />}
            </TouchableOpacity>
          )
        })}
      </View>
    </OnboardingShell>
  )
}
