// 발음 따라하기 채점 (PRD REQ-KL-3 2차) — 녹음 → 서버 전사 → 목표 문장과 유사도 점수.
//
// 왜 점수를 0/100 이 아니라 유사도로 두는가: 학습자의 목표는 완벽한 발음이 아니라 통하는 발음이다.
//   틀렸다고 잘라 말하면 재시도 의욕이 꺾인다. 채점 로직은 서버(pronounce-score)에 있고
//   앱은 녹음·전달·표시만 한다.
// 실패는 학습을 막지 않는다: 키 미설정·인식 실패·녹음 모듈 미포함이면 score:null 로 조용히 넘어간다.
import { supabase } from '@/lib/supabase'

export type PronounceResult = {
  score: number | null // 0~100, null이면 채점 불가(그래도 연습은 계속)
  transcript: string
}

// 녹음 파일(uri) → base64 (expo-file-system 은 이미 다른 기능에서 사용 중)
async function toBase64(uri: string): Promise<string | null> {
  try {
    const res = await fetch(uri)
    const buf = new Uint8Array(await res.arrayBuffer())
    let bin = ''
    for (const b of buf) bin += String.fromCharCode(b)
    return btoa(bin)
  } catch {
    return null
  }
}

export async function scorePronunciation(
  uri: string,
  target: string,
  mimeType = 'audio/m4a',
): Promise<PronounceResult> {
  const audioBase64 = await toBase64(uri)
  if (!audioBase64) return { score: null, transcript: '' }
  try {
    const { data, error } = await supabase.functions.invoke('pronounce-score', {
      body: { audioBase64, mimeType, target },
    })
    if (error) return { score: null, transcript: '' }
    const r = data as PronounceResult
    return { score: r?.score ?? null, transcript: r?.transcript ?? '' }
  } catch {
    return { score: null, transcript: '' }
  }
}
