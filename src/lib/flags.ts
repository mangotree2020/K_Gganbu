// 언어 코드 ↔ 국기 이모지. 리뷰 번역 UI(출발 언어 국기 → 앱 언어 국기 교체)에 사용.
const LANG_FLAG: Record<string, string> = {
  ko: '🇰🇷',
  en: '🇺🇸',
  ja: '🇯🇵',
  zh: '🇨🇳',
  'zh-CN': '🇨🇳',
  'zh-TW': '🇹🇼',
  vi: '🇻🇳',
  th: '🇹🇭',
  id: '🇮🇩',
  fr: '🇫🇷',
  de: '🇩🇪',
  es: '🇪🇸',
  ru: '🇷🇺',
}

// 비교용 베이스 언어 — zh-CN/zh-TW는 'zh'로 통합(중국어 리뷰는 중국어 사용자에게 번역 불필요)
export function baseLang(lang: string): string {
  const l = (lang ?? '').toLowerCase()
  if (l.startsWith('ko')) return 'ko'
  if (l.startsWith('ja')) return 'ja'
  if (l.startsWith('zh')) return 'zh'
  if (l.startsWith('en')) return 'en'
  return l.split('-')[0] || 'en'
}

// 리뷰 출발 언어 → 국기
export function flagFor(lang: string): string {
  const l = (lang ?? '').toLowerCase()
  if (l === 'zh-tw' || l === 'zh-hant' || l === 'zh-hk') return '🇹🇼'
  return LANG_FLAG[baseLang(lang)] ?? '🌐'
}

// 앱 지정 언어(en/ko/ja/zh-CN/zh-TW) → 국기
export function appFlag(appLang: string): string {
  return LANG_FLAG[appLang] ?? LANG_FLAG[baseLang(appLang)] ?? '🌐'
}
