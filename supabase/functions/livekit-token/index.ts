// livekit-token — LiveKit access token(JWT) 발급 Edge Function (PLANNING §25)
// LiveKit AccessToken = HS256 JWT(secret 서명). 클라이언트는 room/identity만 전달.
// 키(LIVEKIT_API_KEY/SECRET)는 서버 시크릿으로 보호 — 클라이언트 미노출.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return `${data}.${b64url(new Uint8Array(sig))}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const apiKey = Deno.env.get('LIVEKIT_API_KEY')
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')
    const lkUrl = Deno.env.get('LIVEKIT_URL') ?? null
    if (!apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: 'no_key', message: 'LIVEKIT_API_KEY/SECRET 미설정' }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json().catch(() => ({}))
    const room: string = body.room ?? `translate-${crypto.randomUUID().slice(0, 8)}`
    const identity: string = body.identity ?? `guest-${crypto.randomUUID().slice(0, 8)}`
    // 통역 방향 메타데이터 (Agent가 읽어 Gemini targetLanguageCode 설정)
    const metadata = JSON.stringify({
      sourceLang: body.sourceLang ?? 'auto',
      targetLang: body.targetLang ?? 'ko',
    })

    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iss: apiKey,
      sub: identity,
      name: identity,
      nbf: now,
      iat: now,
      exp: now + 60 * 30, // 30분
      metadata,
      video: {
        room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    }

    const token = await signJwt(payload, apiSecret)
    return new Response(JSON.stringify({ token, url: lkUrl, room, identity }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
