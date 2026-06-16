// translate — 텍스트 번역 Edge Function (PLANNING §13: Google Cloud Translation 단독)
// Google Cloud Translation v2 사용. 키 미설정 시 502 → 클라이언트 mock 폴백.
// 클라이언트는 source/target/text 만 전달. API 키는 서버 시크릿으로 보호.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Body = { source?: string; target: string; text: string }

// Google Cloud Translation v2 (단독 사용). source 'auto'는 생략하면 자동 감지.
async function googleTranslate(source: string, target: string, text: string) {
  const key = Deno.env.get('GOOGLE_TRANSLATE_KEY')
  if (!key) return null
  const payload: Record<string, string> = { q: text, target, format: 'text' }
  if (source && source !== 'auto') payload.source = source
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) return null
  const json = await res.json()
  return json?.data?.translations?.[0]?.translatedText ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { source = 'auto', target, text }: Body = await req.json()
    if (!text?.trim() || !target) {
      return new Response(JSON.stringify({ error: 'text, target는 필수입니다' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const translated = await googleTranslate(source, target, text)

    if (!translated) {
      return new Response(
        JSON.stringify({
          error: 'no_provider',
          message: '번역 provider 미설정(GOOGLE_TRANSLATE_KEY 필요)',
        }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ translatedText: translated, provider: 'google', source, target }),
      {
        headers: { ...cors, 'Content-Type': 'application/json' },
      },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
