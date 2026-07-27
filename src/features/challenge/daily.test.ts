// 데일리 챌린지 출제 로직 (REQ-KL-1) — 결정론·보기 구성 검증.
// 출제가 흔들리면 "같은 날 다시 들어왔더니 문제가 바뀐다"는 신뢰 문제가 생기므로 고정한다.
import { SCENARIOS } from '@/features/translate/phrases'
import { dailyQuiz, DAILY_COUNT, todayKey } from './daily'

describe('dailyQuiz', () => {
  it('같은 날짜·언어면 항상 같은 문제를 낸다', () => {
    const a = dailyQuiz('ja', '2026-07-28')
    const b = dailyQuiz('ja', '2026-07-28')
    expect(a).toEqual(b)
  })

  it('날짜가 바뀌면 출제도 바뀐다', () => {
    const a = dailyQuiz('ja', '2026-07-28').map((q) => q.ko)
    const b = dailyQuiz('ja', '2026-07-29').map((q) => q.ko)
    expect(a).not.toEqual(b)
  })

  it('문항 수·보기 수를 지키고 정답이 보기에 포함된다', () => {
    const quiz = dailyQuiz('en', '2026-07-28')
    expect(quiz).toHaveLength(DAILY_COUNT)
    for (const q of quiz) {
      expect(q.choices).toHaveLength(4)
      expect(q.choices).toContain(q.answer)
      expect(new Set(q.choices).size).toBe(4) // 보기 중복 없음
      expect(q.ko.length).toBeGreaterThan(0)
    }
  })

  it('한 회차 안에서 같은 문장이 두 번 나오지 않는다', () => {
    const kos = dailyQuiz('zh-CN', '2026-07-28').map((q) => q.ko)
    expect(new Set(kos).size).toBe(kos.length)
  })

  it('한국어 사용자에게는 영어 보기를 준다(한국어 뜻 맞히기는 무의미)', () => {
    // 출제 시드에 언어가 들어가 문항 자체는 en 사용자와 다르지만, 보기 언어는 영어여야 한다
    const englishPhrases = new Set(SCENARIOS.flatMap((s) => s.phrases.map((p) => p.en)))
    for (const q of dailyQuiz('ko', '2026-07-28')) {
      expect(englishPhrases.has(q.answer)).toBe(true)
    }
  })

  it('todayKey 는 KST 날짜를 쓴다 (UTC 15:00 = 다음날 KST)', () => {
    expect(todayKey(new Date('2026-07-28T15:30:00Z'))).toBe('2026-07-29')
    expect(todayKey(new Date('2026-07-28T14:30:00Z'))).toBe('2026-07-28')
  })
})
