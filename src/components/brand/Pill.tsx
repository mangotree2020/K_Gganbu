// Pill — 톤별 배지 (디자인 Pill 대응)
import { View, Text, type ViewStyle } from 'react-native'
import { pillTones, type PillTone } from '@/theme/tokens'

type Size = 'xs' | 'sm' | 'md'

const SIZES: Record<Size, { h: number; fs: number; px: number }> = {
  xs: { h: 18, fs: 9.5, px: 6 },
  sm: { h: 22, fs: 10.5, px: 8 },
  md: { h: 28, fs: 12, px: 10 },
}

type Props = {
  children: React.ReactNode
  tone?: PillTone
  size?: Size
  style?: ViewStyle
}

export function Pill({ children, tone = 'neutral', size = 'sm', style }: Props) {
  const t = pillTones[tone]
  const s = SIZES[size]
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          height: s.h,
          paddingHorizontal: s.px,
          borderRadius: 999,
          backgroundColor: t.bg,
          alignSelf: 'flex-start',
        },
        style,
      ]}>
      {typeof children === 'string' ? (
        <Text style={{ color: t.color, fontSize: s.fs, fontWeight: '600', letterSpacing: 0.1 }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  )
}
