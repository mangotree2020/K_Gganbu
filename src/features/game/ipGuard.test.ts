// IP 가드레일 자동 검사 (PRD REQ-GM-3, BM§8 리스크 "오징어 게임 IP 침해")
// 원칙을 문서에만 적어두면 나중에 누군가 문구를 넣어도 아무도 못 잡는다.
// 사용자에게 노출되는 문자열(i18n)과 게임 화면 소스에 금칙어가 들어오면 테스트가 깨지도록 한다.
//
// 금지: Netflix IP 요소 — "Squid Game"(오징어 게임) 명칭·등장인물·핑크 가드·달고나 챌린지 밈 등.
// 허용: 전통놀이 자체(퍼블릭 도메인)를 'K-Traditional Games'로 브랜딩한 표현.
import { readFileSync } from 'fs'
import { join } from 'path'

// 대소문자·띄어쓰기 변형까지 잡는다
const BANNED: { label: string; re: RegExp }[] = [
  { label: 'Squid Game (en)', re: /squid\s*game/i },
  { label: '오징어 게임 (ko)', re: /오징어\s*게임/ },
  { label: 'イカゲーム (ja)', re: /イカ\s*ゲーム/ },
  { label: '鱿鱼游戏 (zh-CN)', re: /鱿鱼游戏/ },
  { label: '魷魚遊戲 (zh-TW)', re: /魷魚遊戲/ },
  { label: 'pink guard', re: /pink\s*guard|핑크\s*가드/i },
  { label: 'Young-hee doll', re: /young[- ]?hee|영희\s*인형/i },
]

const ROOT = join(__dirname, '..', '..', '..')
const TARGETS = [
  'src/lib/i18n.ts', // 사용자 노출 문자열 전체
  'app/rps-game.tsx',
  'app/tetris.tsx',
  'app/ddakji.tsx', // 전통놀이 본게임 — 드라마 연상 요소가 가장 들어오기 쉬운 화면
  'src/features/game/share.ts', // 공유 문구(SNS로 나가는 텍스트라 특히 중요)
]

describe('게임 IP 가드레일 (REQ-GM-3)', () => {
  it.each(TARGETS)('%s 에 금칙어가 없다', (rel) => {
    const src = readFileSync(join(ROOT, rel), 'utf8')
    for (const { label, re } of BANNED) {
      expect({ file: rel, banned: label, found: re.test(src) }).toEqual({
        file: rel,
        banned: label,
        found: false,
      })
    }
  })

  it('게임존 브랜딩은 K-Traditional Games 계열을 쓴다', () => {
    const i18n = readFileSync(join(ROOT, 'src/lib/i18n.ts'), 'utf8')
    expect(i18n).toMatch(/K-Traditional Games/)
  })
})
