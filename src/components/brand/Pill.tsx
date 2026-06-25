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

// children이 문자열/숫자이거나, 문자열·숫자로만 이루어진 배열이면 Text로 감싼다.
// (예: `✦ {t('...')}` → ['✦ ', '...'] 배열 → 감싸지 않으면 RN 경고/에러)
const isTextual = (c: React.ReactNode): boolean =>
  typeof c === 'string' ||
  typeof c === 'number' ||
  (Array.isArray(c) && c.every((x) => typeof x === 'string' || typeof x === 'number'))

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
      {isTextual(children) ? (
        <Text style={{ color: t.color, fontSize: s.fs, fontWeight: '600', letterSpacing: 0.1 }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  )
}
