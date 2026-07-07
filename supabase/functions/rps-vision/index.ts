// rps-vision — 가위바위보 손 모양 인식 (카메라 모드)
// 셀피 이미지 → Gemini flash-lite vision → rock | paper | scissors | unknown 한 단어.
// 키는 서버 시크릿(GEMINI_API_KEY) — gganbu와 동일 체계.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { imageBase64 } = await req.json()
    if (!imageBase64) return json({ error: 'imageBase64 필요' }, 400)
    const key = Deno.env.get('GEMINI_API_KEY')
    if (!key) return json({ hand: 'unknown', provider: 'mock' })

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
                    'This is a photo of a person playing rock-paper-scissors. ' +
                    'Look at their hand gesture and answer with EXACTLY one word: ' +
                    'rock (fist), paper (open palm), scissors (two fingers), or unknown (no clear hand).',
                },
                { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 10, temperature: 0 },
        }),
      },
    )
    const data = await res.json()
    const text: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.toLowerCase().trim() ?? ''
    const hand = ['rock', 'paper', 'scissors'].find((h) => text.includes(h)) ?? 'unknown'
    return json({ hand, provider: 'gemini' })
  } catch (e) {
    return json({ hand: 'unknown', error: String(e) }, 200)
  }
})
