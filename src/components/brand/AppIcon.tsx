// AppIcon — K-Gganbu 앱 아이콘 (스마일 맵 핀 + 코랄 스파크)
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle } from 'react-native-svg'

type Props = {
  size?: number
  shape?: 'squircle' | 'circle' | 'plain'
  mono?: boolean
}

export function AppIcon({ size = 64, shape = 'squircle', mono = false }: Props) {
  const r = shape === 'circle' ? 256 : shape === 'squircle' ? 116 : 0
  const face = mono ? '#18181B' : '#0284C7'
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Defs>
        <LinearGradient id="bmAppBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#38BDF8" />
          <Stop offset="0.55" stopColor="#0EA5E9" />
          <Stop offset="1" stopColor="#0284C7" />
        </LinearGradient>
      </Defs>
      {shape !== 'plain' && (
        <Rect width="512" height="512" rx={r} fill={mono ? '#18181B' : 'url(#bmAppBg)'} />
      )}
      <Path
        d="M256 96 C 178 96 138 158 138 218 C 138 296 216 348 256 408 C 296 348 374 296 374 218 C 374 158 334 96 256 96 Z"
        fill="#fff"
      />
      <Circle cx="216" cy="206" r="15" fill={face} />
      <Circle cx="296" cy="206" r="15" fill={face} />
      <Path
        d="M210 246 Q 256 286 302 246"
        fill="none"
        stroke={face}
        strokeWidth="17"
        strokeLinecap="round"
      />
      {!mono && (
        <Path d="M392 84 l12 32 32 12 -32 12 -12 32 -12 -32 -32 -12 32 -12 z" fill="#F97316" />
      )}
    </Svg>
  )
}
