// i18n 키 일치 검사 (PLANNING §15 — "언어별 UI 검증", ja 품질 최우선)
//
// 왜 파일을 파싱하나: `src/lib/i18n.ts` 는 MMKV(zustand persist)를 임포트해 jest(node)에서
// 로드할 수 없다. 실제 사전이 한 파일 안에 언어 블록으로 나뉘어 있으므로 텍스트로 읽어 비교한다.
//
// 왜 필요한가: 문자열은 5개 블록에 손으로 추가된다. 한 언어를 빠뜨리면 그 언어 사용자에게만
// 영어(폴백)나 키 문자열이 노출되는데, 화면을 열어보기 전에는 아무도 모른다.
import { readFileSync } from 'fs'
import { join } from 'path'

const LANGS = ['en', 'ko', 'ja', 'zh-CN', 'zh-TW'] as const

// 각 언어 블록의 시작 라인(들여쓰기 2칸) → 다음 블록 전까지의 키(들여쓰기 4칸)를 모은다
function keysByLang(): Record<string, Set<string>> {
  const src = readFileSync(join(__dirname, 'i18n.ts'), 'utf8')
  const lines = src.split('\n')
  const starts: { lang: string; line: number }[] = []
  lines.forEach((l, i) => {
    const m = l.match(/^ {2}'?([a-zA-Z-]+)'?: \{$/)
    if (m && (LANGS as readonly string[]).includes(m[1])) starts.push({ lang: m[1], line: i })
  })
  const out: Record<string, Set<string>> = {}
  starts.forEach((s, idx) => {
    const end = idx + 1 < starts.length ? starts[idx + 1].line : lines.length
    const set = new Set<string>()
    for (let i = s.line + 1; i < end; i++) {
      const km = lines[i].match(/^ {4}'([^']+)':/)
      if (km) set.add(km[1])
    }
    out[s.lang] = set
  })
  return out
}

describe('i18n 5개 언어 키 일치', () => {
  const byLang = keysByLang()

  it('모든 언어 블록을 찾는다', () => {
    expect(Object.keys(byLang).sort()).toEqual([...LANGS].sort())
  })

  it('en 은 키를 충분히 보유한다(파싱 sanity)', () => {
    expect(byLang.en.size).toBeGreaterThan(300)
  })

  it.each(LANGS.filter((l) => l !== 'en'))('%s 에 en 대비 누락 키가 없다', (lang) => {
    const missing = [...byLang.en].filter((k) => !byLang[lang].has(k))
    expect({ lang, missing }).toEqual({ lang, missing: [] })
  })

  it.each(LANGS.filter((l) => l !== 'en'))('%s 에 en 에 없는 잉여 키가 없다', (lang) => {
    const extra = [...byLang[lang]].filter((k) => !byLang.en.has(k))
    expect({ lang, extra }).toEqual({ lang, extra: [] })
  })

  it('한 언어 블록 안에 중복 키가 없다 (뒤 값이 앞 값을 덮어써 조용히 어긋난다)', () => {
    const src = readFileSync(join(__dirname, 'i18n.ts'), 'utf8')
    const lines = src.split('\n')
    const dupes: string[] = []
    const starts: number[] = []
    lines.forEach((l, i) => {
      if (/^ {2}'?[a-zA-Z-]+'?: \{$/.test(l)) starts.push(i)
    })
    starts.forEach((start, idx) => {
      const end = idx + 1 < starts.length ? starts[idx + 1] : lines.length
      const seen = new Set<string>()
      for (let i = start + 1; i < end; i++) {
        const km = lines[i].match(/^ {4}'([^']+)':/)
        if (!km) continue
        if (seen.has(km[1])) dupes.push(`${lines[start].trim()} ${km[1]}`)
        seen.add(km[1])
      }
    })
    expect(dupes).toEqual([])
  })
})
