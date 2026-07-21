// 홈 hero 배경 — 현재 위치 관광지 사진(TourAPI firstimage)을 크로스페이드로 순환.
// expo-image의 transition으로 소스 변경 시 자동 크로스페이드 처리. 메모리+디스크 캐시라
// 재실행 시 즉시 표시되고, prefetch로 순환 전에 미리 디코드해 로딩 지연을 없앤다.
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'

const ROTATE_MS = 10000 // 배경 사진 10초 간격 자동 변경
const FADE_MS = 1100

export function HeroBackdrop({ photos }: { photos: string[] }) {
  const [i, setI] = useState(0)

  // 순환할 원격 사진을 미리 캐시/디코드 — 전환 시점의 지연 제거
  useEffect(() => {
    if (photos.length) void Image.prefetch(photos)
  }, [photos])

  useEffect(() => {
    if (photos.length < 2) return
    const id = setInterval(() => setI((p) => p + 1), ROTATE_MS) // 단조 증가, 렌더에서 모듈로 보정
    return () => clearInterval(id)
  }, [photos])

  if (photos.length === 0) return null
  const cur = i % photos.length

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={{ uri: photos[cur] }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={FADE_MS}
        cachePolicy="memory-disk"
      />
    </View>
  )
}
