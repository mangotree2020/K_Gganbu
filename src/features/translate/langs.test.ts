// 통역 언어 정규화·감지 테스트
//
// 왜 필요한가: Gemini Live가 주는 BCP-47 코드는 표기가 제각각이다('tl-PH' vs 'fil-PH',
// 'in-ID' vs 'id-ID'). 정규화가 어긋나면 말풍선이 엉뚱한 국기·색으로 뜨고, 화자 좌우
// 정렬(isMe 판정)까지 틀어져 대화가 뒤집힌다.
import { INTERPRET_LANGS, detectLang, isRtlLang, langMeta, langTone, normalizeLang } from './langs'
import { palette } from '@/theme/tokens'

describe('normalizeLang', () => {
  it('신규 동남아 언어 코드를 앱 코드로 정규화한다', () => {
    expect(normalizeLang('ms-MY')).toBe('ms')
    expect(normalizeLang('zsm')).toBe('ms') // 표준 말레이어 ISO-639-3
    expect(normalizeLang('fil-PH')).toBe('fil')
    expect(normalizeLang('tl-PH')).toBe('fil') // 타갈로그 구표기 — fil로 통합
    expect(normalizeLang('id-ID')).toBe('id')
    expect(normalizeLang('in-ID')).toBe('id') // 인니어 구표기
    expect(normalizeLang('vi-VN')).toBe('vi')
    expect(normalizeLang('th-TH')).toBe('th')
  })

  it('광둥어는 중국어 계열에 흡수되지 않는다', () => {
    // zh 분기가 먼저 걸리면 광둥어가 zh-TW로 삼켜진다 — 분기 순서 회귀 방지
    expect(normalizeLang('yue')).toBe('yue')
    expect(normalizeLang('yue-Hant-HK')).toBe('yue')
    expect(normalizeLang('zh-yue')).toBe('yue')
    // 표준중국어는 그대로 유지
    expect(normalizeLang('zh-TW')).toBe('zh-TW')
    expect(normalizeLang('cmn-Hans-CN')).toBe('zh-CN')
    // cmn은 표준중국어를 명시한 코드 — 홍콩 표기여도 광둥어로 넘기지 않는다
    expect(normalizeLang('cmn-Hant-HK')).toBe('zh-TW')
  })

  it('남아시아·유럽·중앙아시아 언어 코드를 정규화한다', () => {
    expect(normalizeLang('tr-TR')).toBe('tr')
    expect(normalizeLang('km-KH')).toBe('km')
    expect(normalizeLang('my-MM')).toBe('my')
    expect(normalizeLang('kk-KZ')).toBe('kk')
    expect(normalizeLang('hi-IN')).toBe('hi')
    expect(normalizeLang('bn-BD')).toBe('bn')
    expect(normalizeLang('ne-NP')).toBe('ne')
    expect(normalizeLang('ar-SA')).toBe('ar')
    expect(normalizeLang('ru-RU')).toBe('ru')
    expect(normalizeLang('mn-MN')).toBe('mn')
    expect(normalizeLang('uz-UZ')).toBe('uz')
    expect(normalizeLang('fr-CA')).toBe('fr')
    expect(normalizeLang('de-AT')).toBe('de')
    expect(normalizeLang('es-MX')).toBe('es')
    expect(normalizeLang('pt-BR')).toBe('pt')
    expect(normalizeLang('it-IT')).toBe('it')
  })

  it('기존 언어 매핑을 유지한다', () => {
    expect(normalizeLang('ko-KR')).toBe('ko')
    expect(normalizeLang('ja-JP')).toBe('ja')
    expect(normalizeLang('en-US')).toBe('en')
    expect(normalizeLang('cmn-Hant-TW')).toBe('zh-TW')
    expect(normalizeLang('zh')).toBe('zh-CN')
  })

  it('미지원·빈 코드는 빈 문자열(스크립트 폴백 유도)', () => {
    expect(normalizeLang('ta-IN')).toBe('')
    expect(normalizeLang(undefined)).toBe('')
    expect(normalizeLang('')).toBe('')
  })
})

describe('detectLang', () => {
  it('스크립트로 갈리는 언어를 감지한다', () => {
    expect(detectLang('안녕하세요')).toBe('ko')
    expect(detectLang('こんにちは')).toBe('ja')
    expect(detectLang('สวัสดีครับ')).toBe('th')
    expect(detectLang('Xin chào bạn')).toBe('vi')
    expect(detectLang('你好')).toBe('zh-CN')
    expect(detectLang('मेन्यू दीजिए')).toBe('hi') // 데바나가리
    expect(detectLang('মেনুটা দিন')).toBe('bn') // 벵골 문자
    expect(detectLang('القائمة من فضلك')).toBe('ar') // 아랍 문자
  })

  it('키릴 3개 언어를 전용 자모로 구분한다', () => {
    expect(detectLang('Мәзірді беріңізші')).toBe('kk') // ә/ң — 카자흐 전용
    expect(detectLang('Цэс өгөөч')).toBe('mn') // ө/ү — 카자흐 자모 없음
    expect(detectLang('Меню, пожалуйста')).toBe('ru') // 둘 다 없음
  })

  it('크메르·미얀마 문자를 감지한다', () => {
    expect(detectLang('សូមម៉ឺនុយ')).toBe('km')
    expect(detectLang('မီနူးပေးပါ')).toBe('my')
  })

  it('터키어는 전용 자모가 있을 때만 판별된다', () => {
    // ğ/ı/ş는 터키어 고유. ü/ö는 독일어와 겹쳐 판별에 쓰지 않는다.
    expect(detectLang('Yer fıstığına alerjim var.')).toBe('tr')
    expect(detectLang('Wi-Fi şifresi nedir?')).toBe('tr')
    // 전용 자모가 없는 터키어 문장은 영어로 근사됨 — 폴백의 한계(Gemini 코드가 우선)
    expect(detectLang('Menü, lütfen.')).toBe('en')
  })

  it('라틴 문자는 영어로 근사한다 — ms/fil/id 구분은 Gemini 코드에 맡긴다', () => {
    // 말레이·필리핀·인니어는 라틴 스크립트라 폴백만으로 구분 불가. 오탐 대신 en 근사.
    expect(detectLang('Selamat pagi')).toBe('en')
    expect(detectLang('Magandang umaga')).toBe('en')
  })
})

describe('언어 메타', () => {
  it('신규 언어의 국기·라벨이 정의돼 있다', () => {
    expect(langMeta('ms')).toMatchObject({ flag: '🇲🇾' })
    expect(langMeta('fil')).toMatchObject({ flag: '🇵🇭' })
    expect(langMeta('hi')).toMatchObject({ flag: '🇮🇳' })
    expect(langMeta('ar')).toMatchObject({ flag: '🇸🇦' })
    expect(langMeta('uz')).toMatchObject({ flag: '🇺🇿' })
  })

  it('아랍어만 RTL로 표시된다', () => {
    expect(isRtlLang('ar')).toBe(true)
    INTERPRET_LANGS.filter((l) => l.code !== 'ar').forEach((l) => {
      expect(isRtlLang(l.code)).toBe(false)
    })
  })

  it('타갈로그는 fil로 통합돼 목록에 중복되지 않는다', () => {
    expect(INTERPRET_LANGS.filter((l) => l.code === 'tl')).toHaveLength(0)
    expect(normalizeLang('tl')).toBe('fil')
  })

  it('목록 밖 코드는 지구본 폴백(잘못된 국기 노출 방지)', () => {
    expect(langMeta('sw')).toEqual({ flag: '🌐', label: 'sw' })
    expect(langTone('sw')).toEqual({ accent: palette.zinc[700], tint: palette.zinc[100] })
  })

  it('화자 톤 색상이 언어별로 겹치지 않는다', () => {
    const accents = INTERPRET_LANGS.map((l) => l.tone.accent)
    expect(new Set(accents).size).toBe(accents.length)
  })

  it('코드·TTS 로케일·영어 이름이 모든 언어에 채워져 있다', () => {
    INTERPRET_LANGS.forEach((l) => {
      expect(l.code).toBeTruthy()
      expect(l.ttsLocale).toBeTruthy()
      expect(l.englishName).toBeTruthy()
      expect(l.flag).toBeTruthy()
      expect(l.label).toBeTruthy()
    })
  })

  it('모든 언어 코드는 normalizeLang을 통과해 자기 자신으로 돌아온다', () => {
    // 목록에 언어를 추가하고 normalizeLang 분기를 빠뜨리는 실수를 잡는다.
    INTERPRET_LANGS.forEach((l) => {
      expect(normalizeLang(l.code)).toBe(l.code)
    })
  })
})
