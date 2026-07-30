// 앱 언어 목록 검사 — 선택 가능한 UI 언어(APP_LANGS)가 통역 지원 언어(INTERPRET_LANGS)와
// 같은 집합인지, 순서가 방한 외래객 수 기준으로 유지되는지 본다.
//
// 왜 파일을 파싱하나: `src/lib/i18n.ts`는 MMKV(zustand persist)를 임포트해 jest(node)에서
// 로드할 수 없다(i18n-parity.test.ts와 동일한 이유). langs.ts는 순수 모듈이라 직접 임포트한다.
import { readFileSync } from 'fs'
import { join } from 'path'

import { INTERPRET_LANGS } from '@/features/translate/langs'

const src = readFileSync(join(__dirname, 'i18n.ts'), 'utf8')

// export const LANG_ORDER_BY_INBOUND: AppLang[] = [ 'zh-CN', ... ] 에서 코드만 순서대로 뽑는다
function orderedCodes(): string[] {
  const block = src.match(/export const LANG_ORDER_BY_INBOUND: AppLang\[\] = \[([\s\S]*?)\n\]/)
  if (!block) throw new Error('LANG_ORDER_BY_INBOUND 블록을 찾지 못했다')
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

// export type AppLang = | 'zh-CN' | 'ja' ... 의 유니온 멤버
function unionCodes(): string[] {
  const block = src.match(/export type AppLang =([\s\S]*?)\n\n/)
  if (!block) throw new Error('AppLang 유니온을 찾지 못했다')
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

describe('앱 언어 목록', () => {
  const order = orderedCodes()

  it('통역 지원 언어와 같은 집합이다 (langs.ts에 언어를 추가하면 여기도 등재해야 한다)', () => {
    expect([...order].sort()).toEqual(INTERPRET_LANGS.map((l) => l.code).sort())
  })

  it('중복 코드가 없다', () => {
    expect(order.length).toBe(new Set(order).size)
  })

  it('AppLang 유니온이 목록과 일치한다', () => {
    expect([...unionCodes()].sort()).toEqual([...order].sort())
  })

  it('상위 순서가 방한 외래객 수 기준을 따른다 (중국>일본>영어권>대만>홍콩)', () => {
    expect(order.slice(0, 5)).toEqual(['zh-CN', 'ja', 'en', 'zh-TW', 'yue'])
  })

  it('ko는 방한 통계 대상이 아니라 맨 끝이다', () => {
    expect(order[order.length - 1]).toBe('ko')
  })

  it('UI 사전 보유 언어 5개는 목록에 포함된다', () => {
    for (const code of ['en', 'ko', 'ja', 'zh-CN', 'zh-TW']) expect(order).toContain(code)
  })
})
