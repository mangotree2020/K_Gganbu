// ProfileAvatar — 프로필 아바타. 우선순위: 직접 사진 > 12지신 캐릭터 > 기본(👤).
import { Image, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useProfileStore } from './store'
import { zodiacImage } from './zodiac'

type Props = {
  size?: number
  style?: StyleProp<ViewStyle>
}

export function ProfileAvatar({ size = 64, style }: Props) {
  const photoUri = useProfileStore((s) => s.photoUri)
  const gender = useProfileStore((s) => s.gender)
  const birthYear = useProfileStore((s) => s.birthYear)

  const radius = size / 2
  const base: StyleProp<ViewStyle> = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  }

  if (photoUri) {
    return (
      <View style={[base, style]}>
        <Image
          source={{ uri: photoUri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      </View>
    )
  }

  if (birthYear) {
    return (
      <View style={[base, style]}>
        <Image
          source={zodiacImage(gender, birthYear)}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      </View>
    )
  }

  return (
    <View style={[base, style]}>
      <Text style={{ fontSize: size * 0.5 }}>👤</Text>
    </View>
  )
}
