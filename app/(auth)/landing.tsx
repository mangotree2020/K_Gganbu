import { router } from 'expo-router'
import { Camera, Languages } from 'lucide-react-native'
import { Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

function KambuLogoIcon({ size = 32 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: '#0EA5E9',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View
        style={{
          width: size * 0.44,
          height: size * 0.44,
          borderRadius: size * 0.1,
          backgroundColor: '#fff',
          opacity: 0.92,
          transform: [{ rotate: '45deg' }],
          position: 'absolute',
        }}
      />
      <View
        style={{
          width: size * 0.18,
          height: size * 0.18,
          borderRadius: size * 0.09,
          backgroundColor: '#0EA5E9',
          zIndex: 1,
        }}
      />
    </View>
  )
}

const FEATURES = [
  {
    icon: <Languages size={20} color="#fff" />,
    title: 'Translate anything',
    desc: 'Point your camera at a menu or speak — instant Korean, 5 languages.',
  },
]

const BADGES = ['Works offline', 'No Korean SIM needed', 'Free to start']

export default function LandingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#60A5FA' }}>
      {/* 상단 배경 영역 */}
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* 상단 바 */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 12,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <KambuLogoIcon size={32} />
            <View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>K-Gganbu</Text>
              <Text style={{ fontSize: 8, color: '#BAE6FD', letterSpacing: 0.5 }}>
                TRAVEL · TRANSLATE · 친구
              </Text>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>EN</Text>
            <Text style={{ color: '#fff', fontSize: 10 }}>▾</Text>
          </TouchableOpacity>
        </View>

        {/* 이미지 placeholder */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View
            style={{
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.55)',
              borderStyle: 'dashed',
              borderRadius: 16,
              paddingVertical: 28,
              paddingHorizontal: 32,
              alignItems: 'center',
              gap: 10,
              backgroundColor: 'rgba(255,255,255,0.12)',
              width: '100%',
            }}>
            <Camera size={32} color="rgba(255,255,255,0.85)" />
            <Text
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 13,
                textAlign: 'center',
                lineHeight: 18,
              }}>
              Drop a Busan skyline / Gwangan Bridge photo
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>or browse files</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* 하단 카드 */}
      <SafeAreaView
        edges={['bottom']}
        style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 28,
          paddingBottom: 8,
        }}>
        <Text
          style={{
            fontSize: 26,
            fontWeight: '800',
            color: '#18181B',
            letterSpacing: -0.5,
            marginBottom: 8,
          }}>
          Busan, without the{'\n'}language barrier.
        </Text>
        <Text style={{ fontSize: 14, color: '#71717A', lineHeight: 20, marginBottom: 20 }}>
          Your pocket guide, interpreter, and local friend — from the cruise port to the last
          pojangmacha.
        </Text>

        {/* 기능 카드 */}
        {FEATURES.map((f, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: '#F4F4F5',
              borderRadius: 14,
              padding: 14,
              marginBottom: 24,
            }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#0EA5E9',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {f.icon}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#18181B', marginBottom: 2 }}>
                {f.title}
              </Text>
              <Text style={{ fontSize: 12, color: '#71717A', lineHeight: 17 }}>{f.desc}</Text>
            </View>
          </View>
        ))}

        {/* Get started 버튼 */}
        <TouchableOpacity
          testID="get-started-button"
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.85}
          style={{
            height: 52,
            borderRadius: 14,
            backgroundColor: '#0EA5E9',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 14,
          }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Get started</Text>
          <Text style={{ color: '#fff', fontSize: 18 }}>→</Text>
        </TouchableOpacity>

        {/* Guest 탐색 */}
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.7}
          style={{ alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 14, color: '#71717A' }}>Explore as guest</Text>
        </TouchableOpacity>

        {/* 배지 */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 4,
          }}>
          {BADGES.map((badge, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {i > 0 && <Text style={{ color: '#D4D4D8', fontSize: 12 }}>·</Text>}
              <Text style={{ fontSize: 12, color: '#71717A' }}>{badge}</Text>
            </View>
          ))}
        </View>
      </SafeAreaView>
    </View>
  )
}
