import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { palette, shadows } from '@/theme/tokens'

type Props = {
  step: number // 1-based
  total: number
  title: string
  subtitle: string
  children: ReactNode
  ctaLabel: string
  ctaDisabled?: boolean
  onNext: () => void
  onBack?: () => void
}

// 온보딩 공통 셸 — 그라데이션 헤더 + 진행 점 + 본문 스크롤 + 하단 CTA
export function OnboardingShell({
  step,
  total,
  title,
  subtitle,
  children,
  ctaLabel,
  ctaDisabled,
  onNext,
  onBack,
}: Props) {
  return (
    <View style={{ flex: 1, backgroundColor: palette.zinc[50] }}>
      <LinearGradient
        colors={['#FDBA74', '#38BDF8', '#0EA5E9']}
        locations={[0, 0.6, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ paddingHorizontal: 22, paddingBottom: 22 }}>
        <SafeAreaView edges={['top']}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 6,
              marginBottom: 18,
            }}>
            {onBack ? (
              <TouchableOpacity
                onPress={onBack}
                activeOpacity={0.7}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,.22)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon name="arrow_back" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 34 }} />
            )}
            {/* 진행 점 */}
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {Array.from({ length: total }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === step - 1 ? 22 : 7,
                    height: 7,
                    borderRadius: 999,
                    backgroundColor: i <= step - 1 ? '#fff' : 'rgba(255,255,255,.4)',
                  }}
                />
              ))}
            </View>
            <Text style={{ color: 'rgba(255,255,255,.9)', fontSize: 12, fontWeight: '700' }}>
              {step}/{total}
            </Text>
          </View>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }}>
            {title}
          </Text>
          <Text
            style={{ color: 'rgba(255,255,255,.92)', fontSize: 13, marginTop: 6, lineHeight: 19 }}>
            {subtitle}
          </Text>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 12 }}>
        {children}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <TouchableOpacity
          onPress={onNext}
          disabled={ctaDisabled}
          activeOpacity={0.85}
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: ctaDisabled ? palette.zinc[300] : palette.blue[50],
              borderRadius: 16,
              paddingVertical: 15,
              marginBottom: 12,
            },
            !ctaDisabled && shadows.blue,
          ]}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 }}>
            {ctaLabel}
          </Text>
          <Icon name="arrow_forward" size={18} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  )
}
