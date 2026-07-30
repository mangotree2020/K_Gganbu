// 오프라인 회화 대역 완전성 검사 (PLANNING §15 — 언어별 UI 검증)
//
// 왜 필요한가: 문구는 시나리오별로 손으로 추가된다. 한 언어를 빠뜨리면 그 언어를 고른
// 사용자에게만 빈 칸이 뜨는데, 해당 언어 화면을 열어보기 전에는 아무도 모른다.
// 오프라인 번들이라 네트워크 폴백도 없다.
import { SCENARIOS, type Lang } from './phrases'
import { INTERPRET_LANGS } from './langs'

const LANGS: Lang[] = [
  'en',
  'ja',
  'zh-CN',
  'zh-TW',
  'vi',
  'th',
  'id',
  'ms',
  'fil',
  'hi',
  'bn',
  'fr',
  'de',
  'es',
  'mn',
  'ru',
  'ar',
  'pt',
  'it',
  'ne',
  'uz',
  'yue',
  'tr',
  'km',
  'my',
  'kk',
]

describe('상황별 회화 번들', () => {
  it('모든 문구가 모든 언어 대역을 갖는다', () => {
    SCENARIOS.forEach((s) => {
      s.phrases.forEach((p) => {
        expect(p.ko.trim()).not.toBe('')
        LANGS.forEach((l) => {
          expect(typeof p[l]).toBe('string')
          expect(p[l].trim()).not.toBe('')
        })
      })
    })
  })

  it('회화 언어 = 통역 지원 언어에서 ko(원문)를 뺀 집합', () => {
    // 통역에서 고른 언어로 회화 화면에 들어오므로(translate → phrases) 두 목록이 어긋나면
    // 대역이 없는 언어로 진입해 빈 카드가 뜬다.
    const interpret = INTERPRET_LANGS.map((l) => l.code)
      .filter((c) => c !== 'ko')
      .sort()
    expect([...LANGS].sort()).toEqual(interpret)
  })

  it('시나리오 id가 중복되지 않는다', () => {
    const ids = SCENARIOS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
