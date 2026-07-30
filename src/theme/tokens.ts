// K-Gganbu 디자인 토큰 — docs/K-Gganbu (standalone).html 기준
// Material 3 토큰 모델 + 커스텀 브랜드 팔레트 (bm = Busan Mate)

export const palette = {
  // Brand · Primary — Sky Blue (네비게이션, 아이덴티티, 검색)
  blue: {
    95: '#F0F9FF',
    90: '#E0F2FE',
    80: '#BAE6FD',
    70: '#7DD3FC',
    60: '#38BDF8',
    50: '#0EA5E9',
    40: '#0284C7',
    30: '#0369A1',
    20: '#075985',
    10: '#0C4A6E',
  },
  // Brand · Accent — Coral (쿠폰, FAB, 알림)
  coral: {
    95: '#FFF7ED',
    90: '#FFEDD5',
    80: '#FED7AA',
    70: '#FDBA74',
    60: '#FB923C',
    50: '#F97316',
    40: '#EA580C',
    30: '#C2410C',
    20: '#9A3412',
    10: '#7C2D12',
  },
  // Brand · Translate — Teal (번역 서피스 전용)
  teal: {
    95: '#F0FDFA',
    90: '#CCFBF1',
    80: '#99F6E4',
    70: '#5EEAD4',
    60: '#2DD4BF',
    50: '#14B8A6',
    40: '#0D9488',
    30: '#0F766E',
    20: '#115E59',
    10: '#134E4A',
  },
  // Neutral — Zinc
  zinc: {
    0: '#FFFFFF',
    50: '#FAFAFA',
    100: '#F4F4F5',
    200: '#E4E4E7',
    300: '#D4D4D8',
    400: '#A1A1AA',
    500: '#71717A',
    600: '#52525B',
    700: '#3F3F46',
    800: '#27272A',
    900: '#18181B',
    950: '#09090B',
  },
  amber: { 50: '#F59E0B', 90: '#FEF3C7' },
  cruise: { base: '#1D4ED8', 90: '#DBEAFE' },
  error: { 50: '#DC2626' },
  success: { 50: '#16A34A', 90: '#DCFCE7' },
  // 음성통역 화자(언어) 구분용 보조 톤 — 기존 브랜드 색과 겹치지 않는 hue (accent=채움/보더, tint=배경)
  violet: { 40: '#7C3AED', 95: '#F5F3FF' },
  rose: { 40: '#E11D48', 95: '#FFF1F2' },
  indigo: { 40: '#4F46E5', 95: '#EEF2FF' },
  lime: { 40: '#4D7C0F', 95: '#F7FEE7' }, // 말레이어(ms)
  fuchsia: { 40: '#A21CAF', 95: '#FDF4FF' }, // 필리핀어(fil)
  orange: { 40: '#C2410C', 95: '#FFF7ED' }, // 힌디어(hi) — coral(ja)과 겹치지 않게 진한 톤
  emerald: { 40: '#047857', 95: '#ECFDF5' }, // 벵골어(bn)
  cyan: { 40: '#0891B2', 95: '#ECFEFF' }, // 프랑스어(fr)
  slate: { 40: '#475569', 95: '#F8FAFC' }, // 독일어(de)
  yellow: { 40: '#CA8A04', 95: '#FEFCE8' }, // 스페인어(es)
  purple: { 40: '#7E22CE', 95: '#FAF5FF' }, // 몽골어(mn)
  red: { 40: '#B91C1C', 95: '#FEF2F2' }, // 러시아어(ru)
  brown: { 40: '#78350F', 95: '#FEF6EE' }, // 아랍어(ar)
  green: { 40: '#15803D', 95: '#F0FDF4' }, // 포르투갈어(pt)
  pink: { 40: '#BE185D', 95: '#FDF2F8' }, // 이탈리아어(it)
  sky: { 40: '#0369A1', 95: '#F0F9FF' }, // 네팔어(ne)
  stone: { 40: '#57534E', 95: '#FAFAF9' }, // 우즈베크어(uz)
  maroon: { 40: '#9F1239', 95: '#FFF1F2' }, // 광둥어(yue) — 번체(rose)와 구분
  bronze: { 40: '#B45309', 95: '#FFFBEB' }, // 터키어(tr)
  olive: { 40: '#3F6212', 95: '#F7FEE7' }, // 크메르어(km)
  plum: { 40: '#701A75', 95: '#FDF4FF' }, // 미얀마어(my)
  navy: { 40: '#1E3A8A', 95: '#EFF6FF' }, // 카자흐어(kk)
} as const

// 그라데이션 — LinearGradient colors 배열 (start {x:0,y:0} → end 방향은 사용처에서 지정)
export const gradients = {
  header: ['#38BDF8', '#0EA5E9', '#0284C7'] as const, // 135deg
  morning: ['#FDBA74', '#38BDF8', '#0EA5E9'] as const, // 160deg
  dusk: ['#F97316', '#0EA5E9', '#1D4ED8'] as const, // 160deg
  night: ['#1E1B4B', '#312E81', '#0C4A6E'] as const, // 160deg
  coupon: ['#FB923C', '#F97316', '#EA580C'] as const, // 135deg
  cruise: ['#1D4ED8', '#0EA5E9'] as const, // 135deg
  translate: ['#14B8A6', '#0D9488', '#0EA5E9'] as const, // 135deg
} as const

// 그림자 — RN 스타일 (iOS shadow* + Android elevation)
export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  pop: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  fab: {
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 10,
  },
  blue: {
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 8,
  },
} as const

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 18,
  '3xl': 22,
  '4xl': 32,
  full: 999,
} as const

// Pill 톤 — { bg, color }
export const pillTones = {
  neutral: { bg: palette.zinc[100], color: palette.zinc[700] },
  blue: { bg: palette.blue[90], color: palette.blue[30] },
  coral: { bg: palette.coral[90], color: palette.coral[30] },
  teal: { bg: palette.teal[90], color: palette.teal[30] },
  amber: { bg: palette.amber[90], color: '#92400E' },
  success: { bg: palette.success[90], color: '#15803D' },
  cruise: { bg: palette.cruise[90], color: palette.cruise.base },
  onDark: { bg: 'rgba(255,255,255,0.18)', color: '#fff' },
} as const

export type PillTone = keyof typeof pillTones
