// SheetHeader — 모달 시트 공용 헤더
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from '@/components/brand'
import { palette } from '@/theme/tokens'

type Props = {
  title: string
  sub?: string
  accent?: string
  accentBg?: string
  icon?: string
}

export function SheetHeader({
  title,
  sub,
  accent = palette.blue[50],
  accentBg = palette.blue[95],
  icon,
}: Props) {
  return (
    <View style={ss.row}>
      {icon && (
        <View style={[ss.iconBox, { backgroundColor: accentBg }]}>
          <Icon name={icon} size={20} color={accent} filled />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={ss.title}>{title}</Text>
        {sub && <Text style={ss.sub}>{sub}</Text>}
      </View>
      <Pressable onPress={() => router.back()} style={ss.close}>
        <Icon name="close" size={18} color={palette.zinc[700]} />
      </Pressable>
    </View>
  )
}

const ss = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.zinc[200],
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, color: palette.zinc[900] },
  sub: { fontSize: 12, color: palette.zinc[500], marginTop: 1 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
})
