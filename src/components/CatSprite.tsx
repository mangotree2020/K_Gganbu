// 고양이 스프라이트 애니메이션 — docs/image의 4프레임 시트를 가공한
// assets/cats/{cat_walk,cat_run}.png 사용(프레임별 하단 정렬·배경 투명).
// 프레임 전환은 네이티브 드라이버 Animated로 UI 스레드에서 구동(JS 상태와 무관하게 부드러움).
// 두 동작의 화면 크기는 원본 픽셀 스케일 기준으로 동일하게 맞춘다
// (달리기 자세는 낮고 길어서 같은 스케일이면 걷기보다 화면 높이가 낮다).
import { useEffect, useState } from 'react'
import { Animated, Easing, View } from 'react-native'

// 원본 바디 bbox 높이: walk 290px / run 199px → 같은 축척(px/orig)으로 표시
const SCALE = 26 / 199 // run 표시 높이 26px 기준 공통 축척
const SHEETS = {
  walk: {
    src: require('../../assets/cats/cat_walk.png') as number,
    frameW: 82,
    frameH: 64,
    height: Math.round(290 * SCALE), // ≈38px — 서 있는 자세라 더 큼(실제 크기 동일)
    interval: 200, // 느긋한 걸음
  },
  run: {
    src: require('../../assets/cats/cat_run.png') as number,
    frameW: 118,
    frameH: 64,
    height: 26,
    interval: 110, // 잰 달리기
  },
} as const

export function catWidth(variant: 'walk' | 'run'): number {
  const m = SHEETS[variant]
  return (m.height * m.frameW) / m.frameH
}

export function CatSprite({ variant }: { variant: 'walk' | 'run' }) {
  const meta = SHEETS[variant]
  const av = useState(() => new Animated.Value(0))[0]
  useEffect(() => {
    av.setValue(0)
    const loop = Animated.loop(
      Animated.timing(av, {
        toValue: 4,
        duration: meta.interval * 4,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [variant, meta.interval, av])
  const w = catWidth(variant)
  // 연속 값 → 프레임 단위 계단 이동(스프라이트 셀 전환)
  const tx = av.interpolate({
    inputRange: [0, 0.9999, 1, 1.9999, 2, 2.9999, 3, 4],
    outputRange: [0, 0, -w, -w, -2 * w, -2 * w, -3 * w, -3 * w],
  })
  return (
    <View style={{ width: w, height: meta.height, overflow: 'hidden' }}>
      <Animated.Image
        source={meta.src}
        style={{ width: w * 4, height: meta.height, transform: [{ translateX: tx }] }}
        resizeMode="stretch"
      />
    </View>
  )
}
