// 경량 i18n (PLANNING §6 1차: en/ko/ja/zh-CN/zh-TW)
// 기기 locale 자동감지(Intl) + 수동 선택(MMKV persist). 외부 의존성 없음.
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { zustandStorage } from '@/lib/mmkv'

export type AppLang = 'en' | 'ko' | 'ja' | 'zh-CN' | 'zh-TW'
export const APP_LANGS: { code: AppLang; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zh-CN', label: '中文(简体)', flag: '🇨🇳' },
  { code: 'zh-TW', label: '中文(繁體)', flag: '🇹🇼' },
]

// 기기 locale → 지원 언어 매핑
export function detectDeviceLang(): AppLang {
  let loc = 'en'
  try {
    loc = Intl.DateTimeFormat().resolvedOptions().locale || 'en'
  } catch {
    loc = 'en'
  }
  const lower = loc.toLowerCase()
  if (lower.startsWith('ko')) return 'ko'
  if (lower.startsWith('ja')) return 'ja'
  if (lower.startsWith('zh')) {
    // zh-TW / zh-HK / zh-Hant → 번체, 그 외 zh → 간체
    return /tw|hk|mo|hant/.test(lower) ? 'zh-TW' : 'zh-CN'
  }
  return 'en'
}

type Dict = Record<string, string>
const STRINGS: Record<AppLang, Dict> = {
  en: {
    'tab.home': 'Home',
    'tab.map': 'Map',
    'tab.ai': 'AI Mate',
    'tab.coupons': 'Coupons',
    'tab.my': 'My',
    'home.translateNow': 'Translate',
    'home.translateNowSub': 'Now',
    'home.askAi': 'Ask AI',
    'home.askAiSub': 'Gganbu',
    'home.findPlaces': 'Find',
    'home.findPlacesSub': 'Places',
    'home.nearby': 'Nearby now',
    'home.seeAll': 'See all',
    'common.language': 'Language',
    'common.settings': 'Settings',
    'common.logout': 'Log out',
  },
  ko: {
    'tab.home': '홈',
    'tab.map': '지도',
    'tab.ai': 'AI 깐부',
    'tab.coupons': '쿠폰',
    'tab.my': '내 정보',
    'home.translateNow': '번역',
    'home.translateNowSub': '지금',
    'home.askAi': 'AI에게',
    'home.askAiSub': '깐부',
    'home.findPlaces': '장소',
    'home.findPlacesSub': '찾기',
    'home.nearby': '주변 추천',
    'home.seeAll': '전체보기',
    'common.language': '언어',
    'common.settings': '설정',
    'common.logout': '로그아웃',
  },
  ja: {
    'tab.home': 'ホーム',
    'tab.map': 'マップ',
    'tab.ai': 'AIメイト',
    'tab.coupons': 'クーポン',
    'tab.my': 'マイ',
    'home.translateNow': '翻訳',
    'home.translateNowSub': '今すぐ',
    'home.askAi': 'AIに',
    'home.askAiSub': '聞く',
    'home.findPlaces': '場所',
    'home.findPlacesSub': '検索',
    'home.nearby': '近くのスポット',
    'home.seeAll': 'すべて見る',
    'common.language': '言語',
    'common.settings': '設定',
    'common.logout': 'ログアウト',
  },
  'zh-CN': {
    'tab.home': '首页',
    'tab.map': '地图',
    'tab.ai': 'AI伙伴',
    'tab.coupons': '优惠券',
    'tab.my': '我的',
    'home.translateNow': '翻译',
    'home.translateNowSub': '立即',
    'home.askAi': '问AI',
    'home.askAiSub': '伙伴',
    'home.findPlaces': '查找',
    'home.findPlacesSub': '地点',
    'home.nearby': '附近推荐',
    'home.seeAll': '查看全部',
    'common.language': '语言',
    'common.settings': '设置',
    'common.logout': '退出登录',
  },
  'zh-TW': {
    'tab.home': '首頁',
    'tab.map': '地圖',
    'tab.ai': 'AI夥伴',
    'tab.coupons': '優惠券',
    'tab.my': '我的',
    'home.translateNow': '翻譯',
    'home.translateNowSub': '立即',
    'home.askAi': '問AI',
    'home.askAiSub': '夥伴',
    'home.findPlaces': '尋找',
    'home.findPlacesSub': '地點',
    'home.nearby': '附近推薦',
    'home.seeAll': '查看全部',
    'common.language': '語言',
    'common.settings': '設定',
    'common.logout': '登出',
  },
}

type LocaleState = {
  lang: AppLang
  setLang: (lang: AppLang) => void
}
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      lang: detectDeviceLang(),
      setLang: (lang) => set({ lang }),
    }),
    {
      name: 'locale-storage',
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
)

// 화면에서 사용: const t = useT()  →  t('tab.home')
export function useT() {
  const lang = useLocaleStore((s) => s.lang)
  return (key: string) => STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key
}
