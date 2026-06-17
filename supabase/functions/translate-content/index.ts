// translate-content — 콘텐츠 자동 번역 파이프라인 (PLANNING Phase 2 "콘텐츠 자동 번역")
// 소스 텍스트를 앱 5개 로케일 i18n jsonb({en,ko,ja,zh-CN,zh-TW})로 채운다.
// places/coupons 등 다국어 jsonb 컬럼(§20) 콘텐츠 운영/Admin 등록 시 사용.
// Google Cloud Translation v2 사용(translate 함수와 동일 키). 키 미설정 시 502.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 앱 지원 로케일 (PLANNING §6 1차). Google v2는 zh-CN/zh-TW 코드를 그대로 지원.
const APP_LANGS = ['en', 'ko', 'ja', 'zh-CN', 'zh-TW']

type Body = {
  text: string
  source?: string // 소스 언어 (기본 auto)
  targets?: string[] // 채울 로케일 (기본 5개 전체)
  existing?: Record<string, string> // 이미 채워진 로케일은 건너뜀
}

async function googleTranslate(source: string, target: string, text: string) {
  const key = Deno.env.get('GOOGLE_TRANSLATION_API_KEY')
  if (!key) return { error: 'no_key' }
  const payload: Record<string, string> = { q: text, target, format: 'text' }
  if (source && source !== 'auto') payload.source = source
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { error: json?.error?.message ?? `http_${res.status}` }
  const t = json?.data?.translations?.[0]?.translatedText
  return t ? { text: t } : { error: 'empty_result' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { text, source = 'auto', targets = APP_LANGS, existing = {} }: Body = await req.json()
    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: 'text는 필수입니다' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const i18n: Record<string, string> = { ...existing }
    const errors: Record<string, string> = {}

    for (const lang of targets) {
      if (i18n[lang]) continue // 이미 채워진 로케일 건너뜀
      if (lang === source) {
        i18n[lang] = text
        continue
      }
      const r = await googleTranslate(source, lang, text)
      if (r.text) i18n[lang] = r.text
      else errors[lang] = r.error ?? 'unknown'
    }

    // 한 건도 번역 못 했고 기존값도 없으면 실패 처리(키 미설정 등)
    if (Object.keys(i18n).length === 0) {
      return new Response(JSON.stringify({ error: 'translate_failed', detail: errors }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        i18n,
        provider: 'google',
        errors: Object.keys(errors).length ? errors : undefined,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
