// PlaceThumb — 카테고리별 그라데이션 썸네일 + 아이콘 (디자인 PlaceThumb)
import { LinearGradient } from 'expo-linear-gradient'
import { View } from 'react-native'
import { Icon } from '@/components/brand'

type Cfg = { from: string; to: string; icon: string; color: string }

const MAP: Record<string, Cfg> = {
  food: { from: '#FFEDD5', to: '#FB923C', icon: 'ramen_dining', color: '#9A3412' },
  seafood: { from: '#7DD3FC', to: '#0284C7', icon: 'set_meal', color: '#fff' },
  cafe: { from: '#FEF3C7', to: '#F59E0B', icon: 'local_cafe', color: '#78350F' },
  sights: { from: '#CCFBF1', to: '#2DD4BF', icon: 'photo_camera', color: '#115E59' },
  beach: { from: '#BAE6FD', to: '#0EA5E9', icon: 'beach_access', color: '#0C4A6E' },
  market: { from: '#FFEDD5', to: '#F97316', icon: 'storefront', color: '#7C2D12' },
  cruise: { from: '#DBEAFE', to: '#1D4ED8', icon: 'directions_boat', color: '#fff' },
  cable: { from: '#E0F2FE', to: '#38BDF8', icon: 'aerial_way', color: '#0C4A6E' },
  village: { from: '#FDBA74', to: '#F97316', icon: 'holiday_village', color: '#fff' },
  spa: { from: '#FCE7F3', to: '#EC4899', icon: 'spa', color: '#831843' },
}

type Props = { category: string; height?: number }

export function PlaceThumb({ category, height = 84 }: Props) {
  const c = MAP[category] ?? MAP.sights
  return (
    <LinearGradient
      colors={[c.from, c.to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        height,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
      <View
        style={{
          position: 'absolute',
          bottom: -height * 0.5,
          width: '140%',
          height,
          backgroundColor: 'rgba(255,255,255,.18)',
          borderRadius: 999,
        }}
      />
      <Icon name={c.icon} size={Math.floor(height * 0.42)} color={c.color} filled />
    </LinearGradient>
  )
}
