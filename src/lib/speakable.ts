// 음성용 텍스트 정제 — AI 답변(마크다운/이모지/불릿 포함)을 사람이 말하듯 자연스러운
// "문장만" 남긴다. TTS가 "별표 별표 굵게" 같이 읽지 않도록 서식·기호를 제거한다.

// 이모지 및 기호 픽토그램 범위(서러게이트 페어 포함, u 플래그)
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}]/gu

export function toSpeakable(md: string): string {
  if (!md) return ''
  let s = md

  // 코드블록/이미지 제거
  s = s.replace(/```[\s\S]*?```/g, ' ')
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
  // 링크 [텍스트](url) → 텍스트
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  // 인라인 코드 `x` → x
  s = s.replace(/`([^`]+)`/g, '$1')
  // 굵게/기울임 마커 제거 (**x** *x* __x__ _x_)
  s = s.replace(/(\*\*|__|\*|_)(.*?)\1/g, '$2')
  // URL 제거
  s = s.replace(/https?:\/\/\S+/g, ' ')
  // 수평선 제거
  s = s.replace(/^\s*[-*_]{3,}\s*$/gm, ' ')

  // 줄 단위 처리 — 헤더(#)·인용(>)·리스트(-, *, 1.) 마커 제거, 내용은 문장으로 유지
  const lines = s.split('\n').map((raw) => {
    let line = raw.trim()
    if (!line) return ''
    line = line.replace(/^#{1,6}\s*/, '') // 헤더 마커
    line = line.replace(/^>\s*/, '') // 인용 마커
    line = line.replace(/^[-*+]\s+/, '') // 불릿
    line = line.replace(/^\d+[.)]\s+/, '') // 번호 리스트
    line = line.trim()
    if (!line) return ''
    // 리스트 항목이 문장부호로 끝나지 않으면 마침표를 붙여 자연스러운 끊김 부여
    if (!/[.!?。…~)\]]$/.test(line)) line += '.'
    return line
  })

  s = lines.filter(Boolean).join(' ')

  // 이모지 제거
  s = s.replace(EMOJI, '')
  // 남은 마크다운/장식 기호 정리
  s = s.replace(/[*_#>`|]/g, ' ')
  // 공백 정리
  s = s.replace(/\s{2,}/g, ' ').trim()
  return s
}
