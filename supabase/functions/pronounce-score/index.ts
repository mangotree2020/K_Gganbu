// pronounce-score — 발음 따라하기 채점 (PRD REQ-KL-3 2차)
// 녹음 오디오(base64) + 목표 한국어 문장 → Gemini 오디오 인식으로 전사 → 목표와 대조해 점수.
// rps-vision 과 같은 체계(서버 시크릿 GEMINI_API_KEY, 실패 시 조용한 폴백).
//
// 채점 설계: "정확히 맞았나"가 아니라 **얼마나 가까운가**를 본다. 학습자는 완벽 발음이 목표가 아니고,
//   0/100 판정은 재시도 의욕을 꺾는다. 문자 단위 유사도(0~100)로 부드럽게 돌려준다.
// 키 미설정·인식 실패 시 score:null → 앱은 채점 없이 "다시 듣기/따라하기"만 제공(기능 자체는 유지).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// 비교 전 정규화 — 공백·문장부호는 발음 정확도와 무관하다
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?~…"'’“”\-—]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

// Levenshtein 거리 → 유사도(0~100). 짧은 문장에서 한 글자 차이가 과도한 감점이 되지 않도록 비율 기반.
function similarity(a: string, b: string): number {
  const s = norm(a)
  const t = norm(b)
  if (!s || !t) return 0
  const m = s.length
  const n = t.length
  const prev = new Array(n + 1).fill(0).map((_, j) => j)
  const cur = new Array(n + 1).fill(0)
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1))
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j]
  }
  const dist = prev[n]
  return Math.max(0, Math.round((1 - dist / Math.max(m, n)) * 100))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { audioBase64, mimeType, target } = await req.json()
    if (!audioBase64 || !target) return json({ error: 'audioBase64, target 필요' }, 400)

    const key = Deno.env.get('GEMINI_API_KEY')
    if (!key) return json({ score: null, transcript: '', provider: 'mock' })

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    'Transcribe the Korean speech in this audio EXACTLY as heard, in Hangul. ' +
                    'Output only the transcription with no explanation, no quotes, no romanization. ' +
                    'If there is no intelligible speech, output an empty string.',
                },
                { inline_data: { mime_type: mimeType ?? 'audio/m4a', data: audioBase64 } },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 100, temperature: 0 },
        }),
      },
    )
    const data = await res.json()
    const transcript: string = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
    if (!transcript) return json({ score: null, transcript: '', provider: 'gemini' })

    return json({
      score: similarity(transcript, String(target)),
      transcript,
      provider: 'gemini',
    })
  } catch (e) {
    // 채점 실패는 학습을 막지 않는다 — 앱이 점수 없이 계속 진행하도록 200 으로 응답
    return json({ score: null, transcript: '', error: String(e) }, 200)
  }
})
