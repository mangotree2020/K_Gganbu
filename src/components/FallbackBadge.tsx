// FallbackBadge — 실 API 대신 mock/오프라인 샘플 데이터를 보여줄 때 노출하는 배지
// 신뢰성(PLANNING §14)·네트워크 degrade 안내(§15): 사용자가 샘플임을 인지하도록 한다.
import { Text, type ViewStyle } from 'react-native'
import { Icon, Pill } from '@/components/brand'
import { pillTones } from '@/theme/tokens'

type Props = {
  label?: string
  size?: 'xs' | 'sm' | 'md'
  style?: ViewStyle
}

const FS = { xs: 9.5, sm: 10.5, md: 12 } as const

export function FallbackBadge({ label = 'Sample data', size = 'xs', style }: Props) {
  const color = pillTones.amber.color
  return (
    <Pill tone="amber" size={size} style={style}>
      <Icon name="wifi_off" size={FS[size] + 2} color={color} />
      <Text style={{ color, fontSize: FS[size], fontWeight: '600', letterSpacing: 0.1 }}>
        {label}
      </Text>
    </Pill>
  )
}
