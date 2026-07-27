// 한국어 데일리 챌린지 (PRD REQ-KL-1) — 여행 실전 문장 학습.
// 문제 데이터는 상황별 회화(`features/translate/phrases.ts`)를 그대로 재사용한다.
// 별도 콘텐츠를 만들지 않는 이유: 통역에서 실제로 쓰는 문장이 곧 학습 가치가 있는 문장이고,
// 5개 언어 번역이 이미 검수된 자산이기 때문이다(§15 ja 품질 우선).
import { SCENARIOS, type Phrase } from '@/features/translate/phrases'

export type Quiz = {
  ko: string // 한국어 문장(문제)
  answer: string // 정답 = 사용자 언어 번역
  choices: string[] // 4지선다(정답 포함, 섞임)
  scenario: string // 출처 상황(식당/택시…) — 결과 화면 표시용
}

export const DAILY_COUNT = 5

// 날짜 시드 — 같은 날에는 누구에게나 같은 문제(대화 소재가 되고, 재실행 시 문제가 바뀌지 않음)
export function todayKey(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10) // KST 기준
}

function seedFrom(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// 시드 기반 난수(mulberry32) — 같은 날짜·언어면 항상 같은 출제
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Item = { phrase: Phrase; scenario: string }

const ALL: Item[] = SCENARIOS.flatMap((s) =>
  s.phrases.map((p) => ({ phrase: p, scenario: s.title })),
)

// 한국어 사용자는 뜻 맞히기가 무의미하므로 영어를 보기로 쓴다(학습 대상 = 한국어 문장)
const answerLang = (lang: string) => (lang === 'ko' ? 'en' : lang)

export function dailyQuiz(lang: string, dateKey = todayKey()): Quiz[] {
  const al = answerLang(lang) as keyof Phrase
  const rand = rng(seedFrom(`${dateKey}:${lang}`))
  // 중복 없이 DAILY_COUNT개 뽑기
  const pool = [...ALL]
  const picked: Item[] = []
  while (picked.length < Math.min(DAILY_COUNT, pool.length)) {
    picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0])
  }
  return picked.map((it) => {
    const answer = it.phrase[al] ?? it.phrase.en
    // 오답 보기 — 같은 언어의 다른 문장 3개(정답과 중복 금지)
    const others = ALL.map((x) => x.phrase[al] ?? x.phrase.en).filter((x) => x && x !== answer)
    const wrong: string[] = []
    while (wrong.length < 3 && others.length) {
      const w = others.splice(Math.floor(rand() * others.length), 1)[0]
      if (!wrong.includes(w)) wrong.push(w)
    }
    const choices = [answer, ...wrong]
    // 셔플(정답 위치 고정 방지)
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[choices[i], choices[j]] = [choices[j], choices[i]]
    }
    return { ko: it.phrase.ko, answer, choices, scenario: it.scenario }
  })
}
