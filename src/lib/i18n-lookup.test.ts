import { lookupString } from '@/lib/i18n-lookup'

const STRINGS = {
  en: { 'a.b': 'Hello', only_en: 'EN only' },
  ko: { 'a.b': '안녕' },
}

describe('lookupString', () => {
  it('현재 언어 우선', () => {
    expect(lookupString(STRINGS, 'ko', 'a.b')).toBe('안녕')
  })

  it('현재 언어에 없으면 en 폴백', () => {
    expect(lookupString(STRINGS, 'ko', 'only_en')).toBe('EN only')
  })

  it('미지원 언어 → en 폴백', () => {
    expect(lookupString(STRINGS, 'ja', 'a.b')).toBe('Hello')
  })

  it('어디에도 없으면 키 자체 반환', () => {
    expect(lookupString(STRINGS, 'ko', 'missing.key')).toBe('missing.key')
  })
})
