// 통역·번역 지원 언어 단일 소스 (PLANNING §6 — 1차 5개 + 동남아 5개 확장)
//
// 왜 앱 UI 언어(APP_LANGS)와 분리하나: UI 언어는 i18n.ts에 전체 문자열 사전이 있어야
// 추가되지만, 통역 언어는 Google Translation·Gemini Live가 처리하므로 사전이 필요 없다.
// 두 목록을 같이 쓰면 통역 언어를 늘릴 때마다 UI 번역이 발목을 잡는다.
//
// 화자 톤(tone): 음성통역 말풍선의 화자(언어) 구분용. accent=채움/보더, tint=배경.
import { palette } from '@/theme/tokens'

export type InterpretLang = {
  code: string
  label: string // 해당 언어 원어 표기(선택 목록·칩)
  flag: string
  englishName: string // Gemini systemInstruction용 영어 이름
  ttsLocale: string // expo-speech BCP-47 로케일
  // Google Cloud Translation 코드가 앱 코드와 다를 때만 지정(예: 필리핀어 fil → tl)
  translateCode?: string
  rtl?: boolean // 우→좌 표기 언어(아랍어). 텍스트 정렬에 사용
  tone: { accent: string; tint: string }
}

export const INTERPRET_LANGS: InterpretLang[] = [
  {
    code: 'en',
    label: 'English',
    flag: '🇺🇸',
    englishName: 'English',
    ttsLocale: 'en-US',
    tone: { accent: palette.blue[40], tint: palette.blue[95] },
  },
  {
    code: 'ko',
    label: '한국어',
    flag: '🇰🇷',
    englishName: 'Korean',
    ttsLocale: 'ko-KR',
    tone: { accent: palette.teal[40], tint: palette.teal[95] },
  },
  {
    code: 'ja',
    label: '日本語',
    flag: '🇯🇵',
    englishName: 'Japanese',
    ttsLocale: 'ja-JP',
    tone: { accent: palette.coral[40], tint: palette.coral[95] },
  },
  {
    code: 'zh-CN',
    label: '中文(简体)',
    flag: '🇨🇳',
    englishName: 'Chinese (Simplified)',
    ttsLocale: 'zh-CN',
    tone: { accent: palette.amber[50], tint: palette.amber[90] },
  },
  {
    code: 'zh-TW',
    label: '中文(繁體)',
    flag: '🇹🇼',
    englishName: 'Chinese (Traditional)',
    ttsLocale: 'zh-TW',
    // 간체(amber)와 색이 겹치지 않게 rose
    tone: { accent: palette.rose[40], tint: palette.rose[95] },
  },
  {
    code: 'vi',
    label: 'Tiếng Việt',
    flag: '🇻🇳',
    englishName: 'Vietnamese',
    ttsLocale: 'vi-VN',
    tone: { accent: palette.success[50], tint: palette.success[90] },
  },
  {
    code: 'th',
    label: 'ไทย',
    flag: '🇹🇭',
    englishName: 'Thai',
    ttsLocale: 'th-TH',
    tone: { accent: palette.violet[40], tint: palette.violet[95] },
  },
  {
    code: 'id',
    label: 'Bahasa Indonesia',
    flag: '🇮🇩',
    englishName: 'Indonesian',
    ttsLocale: 'id-ID',
    tone: { accent: palette.indigo[40], tint: palette.indigo[95] },
  },
  {
    // 말레이시아·싱가포르 공용어. 싱가포르는 별도 언어 코드가 없어 en/zh-CN/ms로 커버한다.
    code: 'ms',
    label: 'Bahasa Melayu',
    flag: '🇲🇾',
    englishName: 'Malay',
    ttsLocale: 'ms-MY',
    tone: { accent: palette.lime[40], tint: palette.lime[95] },
  },
  {
    // 필리핀어 = 타갈로그 기반 표준어. 별도 'tl' 항목을 두지 않고 여기로 통합한다
    // (normalizeLang이 'tl'을 'fil'로 흡수, Google Translation에는 'tl'로 전달)
    code: 'fil',
    label: 'Filipino (Tagalog)',
    flag: '🇵🇭',
    englishName: 'Filipino (Tagalog)',
    ttsLocale: 'fil-PH',
    translateCode: 'tl', // Google Translation은 타갈로그를 'tl'로 받는다
    tone: { accent: palette.fuchsia[40], tint: palette.fuchsia[95] },
  },
  {
    code: 'hi',
    label: 'हिन्दी',
    flag: '🇮🇳',
    englishName: 'Hindi',
    ttsLocale: 'hi-IN',
    tone: { accent: palette.orange[40], tint: palette.orange[95] },
  },
  {
    code: 'bn',
    label: 'বাংলা',
    flag: '🇧🇩',
    englishName: 'Bengali',
    ttsLocale: 'bn-BD',
    tone: { accent: palette.emerald[40], tint: palette.emerald[95] },
  },
  {
    code: 'fr',
    label: 'Français',
    flag: '🇫🇷',
    englishName: 'French',
    ttsLocale: 'fr-FR',
    tone: { accent: palette.cyan[40], tint: palette.cyan[95] },
  },
  {
    code: 'de',
    label: 'Deutsch',
    flag: '🇩🇪',
    englishName: 'German',
    ttsLocale: 'de-DE',
    tone: { accent: palette.slate[40], tint: palette.slate[95] },
  },
  {
    code: 'es',
    label: 'Español',
    flag: '🇪🇸',
    englishName: 'Spanish',
    ttsLocale: 'es-ES',
    tone: { accent: palette.yellow[40], tint: palette.yellow[95] },
  },
  {
    code: 'mn',
    label: 'Монгол',
    flag: '🇲🇳',
    englishName: 'Mongolian',
    ttsLocale: 'mn-MN',
    tone: { accent: palette.purple[40], tint: palette.purple[95] },
  },
  {
    code: 'ru',
    label: 'Русский',
    flag: '🇷🇺',
    englishName: 'Russian',
    ttsLocale: 'ru-RU',
    tone: { accent: palette.red[40], tint: palette.red[95] },
  },
  {
    // 유일한 RTL 언어 — 표시 정렬은 rtl 플래그로 처리한다
    code: 'ar',
    label: 'العربية',
    flag: '🇸🇦',
    englishName: 'Arabic',
    ttsLocale: 'ar-SA',
    rtl: true,
    tone: { accent: palette.brown[40], tint: palette.brown[95] },
  },
  {
    // 브라질·유럽 공통으로 통하는 표현을 택했다(§회화 주석 참조)
    code: 'pt',
    label: 'Português',
    flag: '🇵🇹',
    englishName: 'Portuguese',
    ttsLocale: 'pt-BR',
    tone: { accent: palette.green[40], tint: palette.green[95] },
  },
  {
    code: 'it',
    label: 'Italiano',
    flag: '🇮🇹',
    englishName: 'Italian',
    ttsLocale: 'it-IT',
    tone: { accent: palette.pink[40], tint: palette.pink[95] },
  },
  {
    code: 'ne',
    label: 'नेपाली',
    flag: '🇳🇵',
    englishName: 'Nepali',
    ttsLocale: 'ne-NP',
    tone: { accent: palette.sky[40], tint: palette.sky[95] },
  },
  {
    // 우즈베크어는 라틴 표기가 현행 공식 문자
    code: 'uz',
    label: "O'zbekcha",
    flag: '🇺🇿',
    englishName: 'Uzbek',
    ttsLocale: 'uz-UZ',
    tone: { accent: palette.stone[40], tint: palette.stone[95] },
  },
  {
    // 광둥어(홍콩·마카오). 문자는 번체지만 구어가 표준중국어와 달라 별도 항목으로 둔다.
    // 회화 대역은 홍콩 구어체(唔該·幾多錢 등) 표기.
    code: 'yue',
    label: '廣東話',
    flag: '🇭🇰',
    englishName: 'Cantonese',
    ttsLocale: 'yue-HK',
    translateCode: 'yue', // Google Translation의 광둥어(번체) 코드
    tone: { accent: palette.maroon[40], tint: palette.maroon[95] },
  },
  {
    code: 'tr',
    label: 'Türkçe',
    flag: '🇹🇷',
    englishName: 'Turkish',
    ttsLocale: 'tr-TR',
    tone: { accent: palette.bronze[40], tint: palette.bronze[95] },
  },
  {
    code: 'km',
    label: 'ភាសាខ្មែរ',
    flag: '🇰🇭',
    englishName: 'Khmer',
    ttsLocale: 'km-KH',
    tone: { accent: palette.olive[40], tint: palette.olive[95] },
  },
  {
    code: 'my',
    label: 'မြန်မာ',
    flag: '🇲🇲',
    englishName: 'Burmese',
    ttsLocale: 'my-MM',
    tone: { accent: palette.plum[40], tint: palette.plum[95] },
  },
  {
    code: 'kk',
    label: 'Қазақша',
    flag: '🇰🇿',
    englishName: 'Kazakh',
    ttsLocale: 'kk-KZ',
    tone: { accent: palette.navy[40], tint: palette.navy[95] },
  },
]

const BY_CODE: Record<string, InterpretLang> = Object.fromEntries(
  INTERPRET_LANGS.map((l) => [l.code, l]),
)

export const findLang = (code: string): InterpretLang | undefined => BY_CODE[code]

// 라벨 — 미등록 코드는 코드 자체를 노출(엉뚱한 언어로 오인시키지 않음)
export const langLabel = (code: string): string => BY_CODE[code]?.label ?? code

// 국기·라벨 — Gemini Live는 70+ 언어를 감지하므로 목록 밖 코드가 올 수 있다.
// 미등록 시 지구본 폴백(잘못된 국기 노출 방지).
export const langMeta = (code: string): { flag: string; label: string } =>
  BY_CODE[code] ?? { flag: '🌐', label: code || '?' }

export const langTone = (code: string): { accent: string; tint: string } =>
  BY_CODE[code]?.tone ?? { accent: palette.zinc[700], tint: palette.zinc[100] }

export const langEnglishName = (code: string): string | undefined => BY_CODE[code]?.englishName

// RTL 언어 여부(아랍어) — 텍스트 정렬·writingDirection 결정에 사용
export const isRtlLang = (code: string): boolean => BY_CODE[code]?.rtl === true

export const langTtsLocale = (code: string): string | undefined => BY_CODE[code]?.ttsLocale

// 앱 코드 → Google Cloud Translation 코드. 매핑이 없으면 앱 코드를 그대로 쓴다
// ('auto'·미등록 코드도 그대로 통과시켜 서버 판단에 맡긴다).
export const toTranslateCode = (code: string): string => BY_CODE[code]?.translateCode ?? code

// Gemini가 준 BCP-47 감지 코드(예: 'vi-VN','id-ID','cmn-Hant-TW','tl-PH')를 앱 내부 코드로
// 정규화. 미지원 코드는 ''(스크립트 기반 폴백 유도).
export function normalizeLang(code?: string): string {
  if (!code) return ''
  const c = code.toLowerCase()
  if (c.startsWith('ko')) return 'ko'
  if (c.startsWith('ja')) return 'ja'
  if (c.startsWith('th')) return 'th'
  if (c.startsWith('vi')) return 'vi'
  if (c.startsWith('id') || c.startsWith('in')) return 'id' // 인니어 구표기 'in'
  if (c.startsWith('ms') || c.startsWith('may') || c.startsWith('zsm')) return 'ms'
  if (c.startsWith('fil') || c.startsWith('tl')) return 'fil' // 타갈로그 구표기 'tl'
  if (c.startsWith('hi')) return 'hi'
  if (c.startsWith('bn') || c.startsWith('ben')) return 'bn'
  if (c.startsWith('fr')) return 'fr'
  if (c.startsWith('de') || c.startsWith('ger')) return 'de'
  if (c.startsWith('es') || c.startsWith('spa')) return 'es'
  if (c.startsWith('mn') || c.startsWith('mon')) return 'mn'
  if (c.startsWith('ru')) return 'ru'
  if (c.startsWith('ar')) return 'ar'
  if (c.startsWith('pt')) return 'pt'
  if (c.startsWith('it')) return 'it'
  if (c.startsWith('ne') || c.startsWith('nep')) return 'ne'
  if (c.startsWith('uz')) return 'uz'
  if (c.startsWith('tr')) return 'tr'
  if (c.startsWith('km')) return 'km'
  if (c.startsWith('my') || c.startsWith('bur')) return 'my'
  if (c.startsWith('kk')) return 'kk'
  if (c.startsWith('en')) return 'en'
  // 광둥어는 표준중국어와 구어가 달라 별도 코드 — zh 계열보다 먼저 분기해야 흡수되지 않는다.
  // 단 'cmn-*'는 표준중국어를 명시한 코드라 홍콩 표기(cmn-Hant-HK)여도 광둥어가 아니다.
  if (
    c.startsWith('yue') ||
    c.startsWith('zh-yue') ||
    (c.includes('hant-hk') && !c.startsWith('cmn'))
  )
    return 'yue'
  // 그 외 중국어 계열(zh/cmn) — 번체 신호(hant/tw/hk/mo)면 대만, 아니면 간체
  if (c.startsWith('zh') || c.startsWith('cmn')) return /hant|tw|hk|mo/.test(c) ? 'zh-TW' : 'zh-CN'
  return ''
}

// 발화 언어 감지 — Gemini 감지 코드(normalizeLang)가 없을 때만 쓰는 스크립트 기반 폴백.
// 스크립트로 확실히 갈리는 언어만 처리한다. 라틴 계열 세부 구분(en/id/ms/fil)·한자 번체
// 구분(zh-TW)은 스크립트만으로 불확실하므로 시도하지 않고 Gemini 코드에 맡긴다.
export function detectLang(s: string): string {
  if (/[぀-ヿ]/.test(s)) return 'ja' // 가나(일본어) — 한자보다 먼저
  if (/[฀-๿]/.test(s)) return 'th' // 태국 문자
  // 데바나가리는 힌디어·네팔어 공용 — 스크립트만으로 구분 불가하므로 hi로 근사(Gemini 코드 우선)
  if (/[ऀ-ॿ]/.test(s)) return 'hi'
  if (/[ঀ-৿]/.test(s)) return 'bn' // 벵골 문자
  if (/[؀-ۿݐ-ݿ]/.test(s)) return 'ar' // 아랍 문자
  if (/[ក-៿]/.test(s)) return 'km' // 크메르 문자
  if (/[က-႟]/.test(s)) return 'my' // 미얀마 문자
  // 키릴 — 러시아어·몽골어·카자흐어가 같은 스크립트라 전용 자모로 좁혀 간다.
  // 카자흐 전용(ә/ғ/қ/ң/ұ/һ) → 몽골 전용(ө/ү, 카자흐도 쓰므로 뒤에) → 나머지는 러시아어
  if (/[әғқңұһӘҒҚҢҰҺ]/.test(s)) return 'kk'
  if (/[өүӨҮ]/.test(s)) return 'mn'
  if (/[Ѐ-ӿ]/.test(s)) return 'ru' // 그 외 키릴 → 러시아어 근사
  if (/[ğışĞİŞ]/.test(s)) return 'tr' // 터키 전용 라틴 자모
  if (/[đơưăĐƠƯĂ]|[Ạ-ỿ]/.test(s)) return 'vi' // 베트남 전용 발음부호
  const han = (s.match(/[가-힣]/g) || []).length
  const lat = (s.match(/[a-zA-Z]/g) || []).length
  if (han && lat) return lat >= han * 2 ? 'en' : 'ko' // 라틴이 한글의 2배↑면 영어
  if (han) return 'ko'
  // 한자 → 중국어 근사. 번체/간체 구분과 광둥어(yue) 판별은 스크립트로 불가 → Gemini 코드에 맡긴다
  if (/[一-鿿]/.test(s)) return 'zh-CN'
  // 라틴 → 영어 근사. id/ms/fil/fr/de/es 구분은 스크립트만으로 불가하므로 Gemini 코드에 맡긴다
  if (lat) return 'en'
  return '' // 미상
}
