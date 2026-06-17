// ocr — 이미지 텍스트 인식 Edge Function (PLANNING §6 카메라 번역)
// Google Cloud Vision images:annotate(TEXT_DETECTION). 키는 서버 시크릿(GOOGLE_VISION_API_KEY).
// 클라이언트는 base64 이미지를 보내고 인식 텍스트를 받는다. 번역은 translate 함수가 별도 담당.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    // Vision 전용 키 우선, 없으면 동일 GCP 프로젝트의 Translation 키로 폴백
    const apiKey =
      Deno.env.get('GOOGLE_VISION_API_KEY') ?? Deno.env.get('GOOGLE_TRANSLATION_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'no_key', message: 'GOOGLE_VISION_API_KEY 미설정' }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json().catch(() => ({}))
    const image: string = (body.image ?? '').replace(/^data:image\/\w+;base64,/, '')
    if (!image) {
      return new Response(JSON.stringify({ error: 'no_image' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: image },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
            // 한국어 우선 힌트 (메뉴·간판)
            imageContext: { languageHints: ['ko', 'en', 'ja', 'zh'] },
          },
        ],
      }),
    })
    const result = await res.json()
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: 'ocr_failed', detail: result.error?.message ?? result }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    const text: string = result.responses?.[0]?.fullTextAnnotation?.text ?? ''
    return new Response(JSON.stringify({ text }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
