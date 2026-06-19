import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, G, Path, Rect } from 'react-native-svg'

import { BrandMark, Icon } from '@/components/brand'
import { useSignInAnonymous } from '@/features/auth/queries'
import { palette, shadows } from '@/theme/tokens'

type Tone = 'teal' | 'blue' | 'coral'

const FEATURES: { icon: string; emoji: string; title: string; sub: string; tone: Tone }[] = [
  {
    icon: 'translate',
    emoji: '🗣️',
    title: 'Translate anything',
    sub: 'Point your camera at a menu or speak — instant Korean, 5 languages.',
    tone: 'teal',
  },
  {
    icon: 'compare_arrows',
    emoji: '🗺️',
    title: 'Two map views',
    sub: 'Compare local (Naver) vs traveler (Google) reviews side by side.',
    tone: 'blue',
  },
  {
    icon: 'smart_toy',
    emoji: '🤖',
    title: 'Your AI travel Gganbu',
    sub: 'Plans, budgets, and rescues you in real time — built on Claude.',
    tone: 'coral',
  },
]

const TONE_COLOR: Record<Tone, string> = {
  teal: palette.teal[40],
  blue: palette.blue[50],
  coral: palette.coral[50],
}
const TONE_TINT: Record<Tone, string> = {
  teal: palette.teal[95],
  blue: palette.blue[95],
  coral: palette.coral[95],
}

// 부산 도심 실루엣 — 히어로 폴백 오버레이
function CitySilhouette() {
  return (
    <Svg
      viewBox="0 0 392 440"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3 }}>
      <Circle cx="310" cy="90" r="44" fill="rgba(255,255,255,0.4)" />
      <Path
        d="M0 360 L60 300 L120 340 L180 270 L250 320 L320 250 L392 310 L392 440 L0 440 Z"
        fill="rgba(15,23,42,0.22)"
      />
      <G fill="rgba(15,23,42,0.34)">
        <Rect x="40" y="330" width="16" height="80" />
        <Rect x="64" y="350" width="24" height="60" />
        <Rect x="150" y="320" width="14" height="90" />
        <Rect x="172" y="345" width="20" height="65" />
        <Rect x="250" y="310" width="13" height="100" />
        <Rect x="270" y="340" width="22" height="70" />
        <Rect x="320" y="330" width="15" height="80" />
        <Rect x="342" y="350" width="24" height="60" />
      </G>
    </Svg>
  )
}

export default function LandingScreen() {
  const [feature, setFeature] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const {
    mutate: signInAnonymous,
    isPending: guestPending,
    error: guestError,
  } = useSignInAnonymous()

  useEffect(() => {
    timer.current = setInterval(() => setFeature((f) => (f + 1) % FEATURES.length), 2800)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [])

  const f = FEATURES[feature]

  return (
    <View style={{ flex: 1, backgroundColor: palette.zinc[50] }}>
      {/* 히어로 영역 (화면 52%) */}
      <View style={{ height: '52%', overflow: 'hidden' }}>
        <LinearGradient
          colors={['#FDBA74', '#38BDF8', '#0EA5E9', '#1D4ED8']}
          locations={[0, 0.45, 0.7, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.4, y: 1 }}
          style={{ position: 'absolute', inset: 0 }}
        />
        <CitySilhouette />
        {/* 하단 페이드 (콘텐츠로 자연스럽게 연결) */}
        <LinearGradient
          colors={['rgba(0,0,0,0.28)', 'transparent', 'transparent', palette.zinc[50]]}
          locations={[0, 0.3, 0.6, 1]}
          style={{ position: 'absolute', inset: 0 }}
        />
        {/* 상단 바 */}
        <SafeAreaView edges={['top']}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 18,
              paddingTop: 8,
            }}>
            <BrandMark size={36} light />
            <TouchableOpacity
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: 'rgba(0,0,0,0.32)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.28)',
                borderRadius: 999,
                paddingHorizontal: 11,
                paddingVertical: 6,
              }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>🌐 EN</Text>
              <Icon name="expand_more" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* 콘텐츠 영역 */}
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 8 }}>
        <Text
          style={{
            fontSize: 27,
            fontWeight: '800',
            letterSpacing: -0.6,
            lineHeight: 30,
            color: palette.zinc[900],
          }}>
          Busan, without the{'\n'}language barrier.
        </Text>
        <Text style={{ fontSize: 13.5, color: palette.zinc[500], marginTop: 8, lineHeight: 20 }}>
          Your Korean best friend on the trip — interpreter, map, and local guide from the cruise
          port to the last pojangmacha.
        </Text>

        {/* 회전 피처 카드 */}
        <View
          style={[
            {
              marginTop: 18,
              backgroundColor: '#fff',
              borderWidth: 0.5,
              borderColor: palette.zinc[200],
              borderRadius: 18,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              minHeight: 78,
            },
            shadows.card,
          ]}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              backgroundColor: TONE_TINT[f.tone],
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name={f.icon} size={24} color={TONE_COLOR[f.tone]} filled />
            <Text style={{ position: 'absolute', top: -8, right: -8, fontSize: 18 }}>
              {f.emoji}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '800',
                color: palette.zinc[900],
                letterSpacing: -0.2,
              }}>
              {f.title}
            </Text>
            <Text
              style={{ fontSize: 11.5, color: palette.zinc[500], marginTop: 2, lineHeight: 16 }}>
              {f.sub}
            </Text>
          </View>
        </View>

        {/* 인디케이터 점 */}
        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 14 }}>
          {FEATURES.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => setFeature(i)}
              style={{
                width: i === feature ? 22 : 7,
                height: 7,
                borderRadius: 999,
                backgroundColor: i === feature ? palette.blue[50] : palette.zinc[300],
              }}
            />
          ))}
        </View>

        {/* CTA */}
        <View style={{ marginTop: 'auto', paddingBottom: 26 }}>
          <TouchableOpacity
            testID="get-started-button"
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: palette.blue[50],
                borderRadius: 16,
                paddingVertical: 15,
              },
              shadows.blue,
            ]}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 }}>
              Get started
            </Text>
            <Icon name="arrow_forward" size={18} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            testID="guest-button"
            onPress={() => signInAnonymous()}
            disabled={guestPending}
            activeOpacity={0.7}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 10,
              height: 36,
              flexShrink: 0,
            }}>
            <Text style={{ fontSize: 13, color: palette.zinc[600], fontWeight: '600' }}>
              {guestPending ? 'Entering…' : 'Explore as guest'}
            </Text>
          </TouchableOpacity>
          {guestError && (
            <Text
              style={{ fontSize: 11, color: palette.error[50], textAlign: 'center', marginTop: 4 }}>
              {guestError.message}
            </Text>
          )}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: 6,
            }}>
            <Icon name="wifi_off" size={12} color={palette.zinc[400]} />
            <Text style={{ fontSize: 10.5, color: palette.zinc[400], fontWeight: '600' }}>
              Works offline
            </Text>
            <Text style={{ color: palette.zinc[300] }}>·</Text>
            <Icon name="sim_card" size={12} color={palette.zinc[400]} />
            <Text style={{ fontSize: 10.5, color: palette.zinc[400], fontWeight: '600' }}>
              No Korean SIM
            </Text>
            <Text style={{ color: palette.zinc[300] }}>·</Text>
            <Text style={{ fontSize: 10.5, color: palette.zinc[400], fontWeight: '600' }}>
              Free to start
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
