// 고양이 스프라이트 애니메이션 — docs/image의 4프레임 시트를 원본 해상도 그대로
// (배경 투명화 + 전 프레임 공통 세로 밴드 크롭) 가공한 assets/cats/*.png 사용.
// 점프의 포물선·기준선이 원본 그대로 보존되며, 화면 축소는 스타일로만 처리(화질 유지).
// 프레임 전환은 네이티브 드라이버 Animated 계단 보간(UI 스레드) — walk/run은 루프,
// turn(방향 전환)/jump(걷기→달리기 전환)는 1회 재생 후 onEnd 콜백.
import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, View } from 'react-native'

export type CatVariant = 'walk' | 'run' | 'turn' | 'jump'

// 동일 원본 캔버스(2172px) 시트는 공통 축척(걷기 34px 기준)으로 표시 — 실제 크기 일치.
const S = 34 / 291
const SHEETS = {
  walk: {
    src: require('../../assets/cats/cat_walk.png') as number,
    frameW: 462,
    frameH: 291,
    height: 27, // 34에서 20% 축소(사용자 피드백)
    interval: 200,
    loop: true,
  },
  run: {
    // 구형 캔버스(1672px) — 사용자 확정 크기 26px 유지
    src: require('../../assets/cats/cat_run.png') as number,
    frameW: 373,
    frameH: 199,
    height: 26,
    interval: 110,
    loop: true,
  },
  turn: {
    src: require('../../assets/cats/cat_turn.png') as number,
    frameW: 463,
    frameH: 345,
    height: Math.round(345 * S), // ≈40
    interval: 170, // 전환이 눈에 보이도록 감속
    loop: false,
  },
  jump: {
    src: require('../../assets/cats/cat_jump.png') as number,
    frameW: 517,
    frameH: 373,
    height: Math.round(373 * S), // ≈44
    interval: 230, // 점프가 눈에 보이도록 감속(총 ~0.9s)
    loop: false,
  },
} as const

export function catWidth(variant: CatVariant): number {
  const m = SHEETS[variant]
  return (m.height * m.frameW) / m.frameH
}

export function catHeight(variant: CatVariant): number {
  return SHEETS[variant].height
}

export function CatSprite({ variant, onEnd }: { variant: CatVariant; onEnd?: () => void }) {
  const meta = SHEETS[variant]
  const av = useState(() => new Animated.Value(0))[0]
  const onEndRef = useRef(onEnd)
  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])
  useEffect(() => {
    av.setValue(0)
    const timing = Animated.timing(av, {
      toValue: 4,
      duration: meta.interval * 4,
      easing: Easing.linear,
      useNativeDriver: true,
    })
    if (meta.loop) {
      const loop = Animated.loop(timing)
      loop.start()
      return () => loop.stop()
    }
    timing.start(({ finished }) => {
      if (finished) onEndRef.current?.()
    })
    return () => timing.stop()
  }, [variant, meta.interval, meta.loop, av])
  // 정수 폭 + 좌우 1px 인셋 — 서브픽셀 보간으로 옆 프레임이 끄트머리에 비치는 것 차단
  const w = Math.round(catWidth(variant))
  const tx = av.interpolate({
    inputRange: [0, 0.9999, 1, 1.9999, 2, 2.9999, 3, 4],
    outputRange: [-1, -1, -w - 1, -w - 1, -2 * w - 1, -2 * w - 1, -3 * w - 1, -3 * w - 1],
  })
  return (
    <View style={{ width: w - 2, height: meta.height, overflow: 'hidden' }}>
      <Animated.Image
        source={meta.src}
        style={{ width: w * 4, height: meta.height, transform: [{ translateX: tx }] }}
        resizeMode="stretch"
      />
    </View>
  )
}
