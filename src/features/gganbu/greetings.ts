// AI 깐부의 홈 인사 메시지 — 시간대 × 날씨 × 도시에 맞춘 짧은 "현지 친구" 톤.
// UI chrome이 아닌 동적 페르소나 카피라 i18n.ts와 분리해 여기서 언어별로 관리한다.
// {city}는 호출측에서 짧은 도시명으로 치환.
import type { WeatherCondition } from '@/features/weather/queries'

type Bucket = 'dawn' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'

function bucketOf(hour: number): Bucket {
  if (hour < 5) return 'night'
  if (hour < 8) return 'dawn'
  if (hour < 11) return 'morning'
  if (hour < 14) return 'midday'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}

type Pool = Record<Bucket, string[]> & {
  rain: string[]
  snow: string[]
  storm: string[]
}

const POOLS: Record<string, Pool> = {
  en: {
    dawn: ['Early start in {city}? I’ve got you.', 'Dawn over {city} — let’s keep it light.'],
    morning: ['Morning, {city}! Coffee then explore?', 'Fresh morning in {city}. Where to first?'],
    midday: ['Lunch o’clock in {city} — hungry?', 'Midday in {city}. Find a local spot?'],
    afternoon: ['Afternoon in {city} — fancy a stroll?', 'Slow afternoon. A café in {city}?'],
    evening: ['Evening in {city} — night views?', 'Dinner time in {city}. Seafood?'],
    night: ['Late night in {city}. Stay safe!', '{city} after dark — last bites?'],
    rain: ['Rainy {city} — I’ve picked indoor spots.', 'Grab an umbrella in {city} today.'],
    snow: ['Snowy {city} — bundle up!', 'Snow in {city}. Warm café nearby?'],
    storm: ['Rough weather in {city} — stay cozy indoors.'],
  },
  ko: {
    dawn: ['이른 아침 {city}, 제가 도울게요.', '{city} 동틀 무렵, 가볍게 시작해요.'],
    morning: ['좋은 아침 {city}! 커피 한 잔?', '상쾌한 {city}의 아침, 어디부터 갈까요?'],
    midday: ['{city} 점심 시간, 배고프죠?', '한낮의 {city}, 현지 맛집 찾을까요?'],
    afternoon: ['{city}의 오후, 산책 어때요?', '느긋한 오후, {city} 카페 갈까요?'],
    evening: ['{city}의 저녁, 야경 보러 갈까요?', '저녁이에요. {city}에서 회 한 점?'],
    night: ['늦은 밤 {city}, 안전하게 들어가요!', '밤의 {city}, 야식 어때요?'],
    rain: ['비 오는 {city}, 실내 명소 골라뒀어요.', '오늘 {city}는 우산 챙기세요.'],
    snow: ['눈 내리는 {city}, 따뜻하게 입어요!', '{city}에 눈이네요. 따뜻한 카페 어때요?'],
    storm: ['{city} 날씨가 사나워요. 실내가 안전해요.'],
  },
  ja: {
    dawn: ['早朝の{city}、お任せを。', '{city}の夜明け、軽めに始めましょう。'],
    morning: ['おはよう{city}！まずコーヒー？', '爽やかな{city}の朝、どこへ？'],
    midday: ['{city}はお昼時、お腹すいた？', '昼の{city}、地元の名店へ？'],
    afternoon: ['{city}の午後、散歩しませんか？', 'のんびり午後、{city}のカフェへ？'],
    evening: ['{city}の夕方、夜景はいかが？', '夕食の時間、{city}で海鮮？'],
    night: ['夜更けの{city}、気をつけて！', '夜の{city}、夜食でもどう？'],
    rain: ['雨の{city}、屋内スポット用意済み。', '今日の{city}は傘を忘れずに。'],
    snow: ['雪の{city}、暖かくしてね！', '{city}は雪。暖かいカフェへ？'],
    storm: ['{city}は荒天、屋内が安心です。'],
  },
  'zh-CN': {
    dawn: ['{city}清晨，交给我吧。', '{city}破晓，轻松开始吧。'],
    morning: ['早安{city}！先来杯咖啡？', '清新的{city}早晨，先去哪？'],
    midday: ['{city}午餐时间，饿了吧？', '正午的{city}，找家本地店？'],
    afternoon: ['{city}的午后，散步如何？', '悠闲午后，去{city}咖啡馆？'],
    evening: ['{city}傍晚，看夜景吗？', '晚餐时间，{city}吃海鲜？'],
    night: ['{city}深夜，注意安全！', '夜晚的{city}，来点宵夜？'],
    rain: ['雨天{city}，室内景点已备好。', '今天{city}记得带伞。'],
    snow: ['下雪的{city}，注意保暖！', '{city}下雪了，找家暖咖啡馆？'],
    storm: ['{city}天气恶劣，室内更安全。'],
  },
  'zh-TW': {
    dawn: ['{city}清晨，交給我吧。', '{city}破曉，輕鬆開始吧。'],
    morning: ['早安{city}！先來杯咖啡？', '清新的{city}早晨，先去哪？'],
    midday: ['{city}午餐時間，餓了吧？', '正午的{city}，找家在地店？'],
    afternoon: ['{city}的午後，散步如何？', '悠閒午後，去{city}咖啡館？'],
    evening: ['{city}傍晚，看夜景嗎？', '晚餐時間，{city}吃海鮮？'],
    night: ['{city}深夜，注意安全！', '夜晚的{city}，來點宵夜？'],
    rain: ['雨天{city}，室內景點已備好。', '今天{city}記得帶傘。'],
    snow: ['下雪的{city}，注意保暖！', '{city}下雪了，找家暖咖啡館？'],
    storm: ['{city}天氣惡劣，室內更安全。'],
  },
}

// 시간대 인사말 — [아침, 오후, 저녁, 밤]. 앱 시작 시 greeting 스타일로 표시.
const GREETINGS: Record<string, [string, string, string, string]> = {
  en: ['Good morning', 'Good afternoon', 'Good evening', 'Good night'],
  ko: ['좋은 아침이에요', '좋은 오후예요', '좋은 저녁이에요', '편안한 밤 되세요'],
  ja: ['おはようございます', 'こんにちは', 'こんばんは', 'おやすみなさい'],
  'zh-CN': ['早上好', '下午好', '晚上好', '晚安'],
  'zh-TW': ['早安', '午安', '晚安', '晚安'],
}

export function gganbuGreeting(lang: string, hour: number): string {
  const g = GREETINGS[lang] ?? GREETINGS.en
  if (hour < 5) return g[3] // 새벽 0~5시는 밤 인사
  if (hour < 11) return g[0]
  if (hour < 17) return g[1]
  if (hour < 21) return g[2]
  return g[3]
}

// 컨텍스트(언어·시간·날씨·도시)에 맞는 메시지 풀 생성. 악천후면 날씨 메시지 우선.
export function buildGganbuGreetings(
  lang: string,
  hour: number,
  condition: WeatherCondition | undefined,
  city: string,
): string[] {
  const pool = POOLS[lang] ?? POOLS.en
  const weather =
    condition === 'rain'
      ? pool.rain
      : condition === 'snow'
        ? pool.snow
        : condition === 'storm'
          ? pool.storm
          : []
  // 악천후 메시지 + 시간대 메시지를 함께 순환(날씨를 먼저 보여줌)
  const base = pool[bucketOf(hour)]
  const merged = [...weather, ...base]
  return merged.map((m) => m.replace(/\{city\}/g, city))
}
