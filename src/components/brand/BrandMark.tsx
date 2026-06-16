// BrandMark — 앱 아이콘 + 워드마크 (K-Gganbu · Travel · Translate · 깐부)
import { View, Text } from 'react-native'
import { AppIcon } from './AppIcon'
import { palette } from '@/theme/tokens'

type Props = {
  size?: number
  light?: boolean
}

export function BrandMark({ size = 44, light = false }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <AppIcon size={size} shape="squircle" />
      <View>
        <Text
          style={{
            fontSize: size * 0.42,
            fontWeight: '800',
            letterSpacing: -0.4,
            color: light ? '#fff' : palette.zinc[900],
          }}>
          K-Gganbu
        </Text>
        <Text
          style={{
            fontSize: size * 0.22,
            fontWeight: '600',
            letterSpacing: 1.5,
            marginTop: 2,
            color: light ? 'rgba(255,255,255,0.8)' : palette.blue[40],
          }}>
          TRAVEL · TRANSLATE · 깐부
        </Text>
      </View>
    </View>
  )
}
