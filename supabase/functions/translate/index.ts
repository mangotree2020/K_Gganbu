// translate — 텍스트 번역 Edge Function
// Papago(NCP) 우선 → 실패 시 Google Translation v2(키 있으면) → 둘 다 없으면 502
// 클라이언트는 source/target/text 만 전달. API 키는 서버 시크릿으로 보호.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Body = { source?: string; target: string; text: string }

async function papago(source: string, target: string, text: string) {
  const id = Deno.env.get('NAVER_CLIENT_ID')
  const secret = Deno.env.get('NAVER_CLIENT_SECRET')
  if (!id || !secret) return null
  const res = await fetch('https://naveropenapi.apigw.ntruss.com/nmt/v1/translation', {
    method: 'POST',
    headers: {
      'X-NCP-APIGW-API-KEY-ID': id,
      'X-NCP-APIGW-API-KEY': secret,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ source, target, text }).toString(),
  })
  if (!res.ok) return null
  const json = await res.json()
  return json?.message?.result?.translatedText ?? null
}

async function google(source: string, target: string, text: string) {
  const key = Deno.env.get('GOOGLE_TRANSLATE_KEY')
  if (!key) return null
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source, target, format: 'text' }),
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

    // Papago는 'auto' 미지원 → ko/en 추정
    const src = source === 'auto' ? (/[가-힣]/.test(text) ? 'ko' : 'en') : source

    let translated = await papago(src, target, text)
    let provider = 'papago'
    if (!translated) {
      translated = await google(src, target, text)
      provider = 'google'
    }

    if (!translated) {
      return new Response(
        JSON.stringify({
          error: 'no_provider',
          message: '번역 provider 미설정(Papago/Google 키 필요)',
        }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ translatedText: translated, provider, source: src, target }),
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
