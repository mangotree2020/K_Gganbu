import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ticket } from 'lucide-react-native'

export default function CouponsScreen() {
  return (
    <SafeAreaView style={ss.container}>
      <View style={ss.center}>
        <View style={ss.iconBox}>
          <Ticket size={36} color="#F97316" />
        </View>
        <Text style={ss.title}>Coupons</Text>
        <Text style={ss.sub}>24 deals near Haeundae{'\n'}local discounts coming soon</Text>
      </View>
    </SafeAreaView>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#18181B', letterSpacing: -0.4 },
  sub: { fontSize: 13, color: '#71717A', textAlign: 'center', lineHeight: 20 },
})
