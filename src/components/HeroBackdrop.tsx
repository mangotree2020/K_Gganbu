// 홈 hero 배경 — 현재 위치 관광지 사진(TourAPI firstimage)을 크로스페이드로 순환.
// 두 레이어를 겹쳐 next를 페이드 인 → 커밋해 깜빡임 없이 전환. 사진 없으면 아무것도 안 그림
// (호출측이 그라데이션 폴백 유지).
import { useEffect, useState } from 'react'
import { Animated, Image, StyleSheet, View } from 'react-native'

const ROTATE_MS = 10000 // 배경 사진 10초 간격 자동 변경
const FADE_MS = 1100

export function HeroBackdrop({ photos }: { photos: string[] }) {
  const [i, setI] = useState(0)
  // Animated.Value는 lazy state로 1회 생성(ref 렌더 접근 회피)
  const [top] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (photos.length < 2) return
    let cancelled = false
    const id = setInterval(() => {
      Animated.timing(top, {
        toValue: 1,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) {
          setI((p) => p + 1) // 단조 증가, 렌더에서 모듈로로 범위 보정
          top.setValue(0)
        }
      })
    }, ROTATE_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [photos, top])

  if (photos.length === 0) return null
  const cur = i % photos.length
  const next = (i + 1) % photos.length

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri: photos[cur] }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        fadeDuration={0}
      />
      {photos.length > 1 && (
        <Animated.Image
          source={{ uri: photos[next] }}
          style={[StyleSheet.absoluteFill, { opacity: top }]}
          resizeMode="cover"
          fadeDuration={0}
        />
      )}
    </View>
  )
}
