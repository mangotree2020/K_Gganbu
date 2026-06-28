// receipt-ocr (#26 Phase 2) — 영수증 이미지 → Google Vision OCR → 합계금액·날짜·상호 휴리스틱
// 추출 → tax_free_receipts 저장(source=scanned). 쓰기는 service role(RLS 우회).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const VISION_KEY = Deno.env.get('GOOGLE_VISION_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// 한국 부가세 10% → 환급 추정(앱 types.estimateRefund 와 동일 규칙).
const MIN_ELIGIBLE_KRW = 15000
function estimateRefund(amount: number): number {
  if (!Number.isFinite(amount) || amount < MIN_ELIGIBLE_KRW) return 0
  return Math.round((amount / 11) * 0.9)
}

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

// ── 영수증 휴리스틱 파서 ───────────────────────────────────────────────────
// 합계: 합계/총액/받을금액/결제금액/TOTAL/AMOUNT 라인의 최대 숫자, 없으면 전체 최대 통화숫자.
function parseAmount(text: string): number {
  const lines = text.split('\n')
  const num = (s: string): number[] => {
    const m = s.match(/[0-9][0-9,]{2,}/g)
    return m ? m.map((x) => parseInt(x.replace(/,/g, ''), 10)).filter((n) => n >= 100) : []
  }
  const keyword = /(합\s*계|총\s*액|받을\s*금액|결제\s*금액|판매\s*금액|total|amount|구매액)/i
  const keyed: number[] = []
  for (const l of lines) if (keyword.test(l)) keyed.push(...num(l))
  if (keyed.length) return Math.max(...keyed)
  // 폴백: 전체에서 가장 큰 통화 숫자(합계가 보통 최대)
  const all: number[] = []
  for (const l of lines) all.push(...num(l))
  return all.length ? Math.max(...all) : 0
}

// 날짜: YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD → ISO. 없으면 null.
function parseDate(text: string): string | null {
  const m = text.match(/(20\d{2})[.\-/년 ]+(\d{1,2})[.\-/월 ]+(\d{1,2})/)
  if (!m) return null
  const yyyy = m[1]
  const mm = m[2].padStart(2, '0')
  const dd = m[3].padStart(2, '0')
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return null
  return `${yyyy}-${mm}-${dd}`
}

// 상호: 상호/점/store 키워드 라인 우선, 없으면 첫 의미있는 텍스트 라인.
function parseStore(text: string): string | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const hit = lines.find((l) => /(상\s*호|점\s*명|store|매장)/i.test(l))
  if (hit) {
    const v = hit.replace(/.*(상\s*호|점\s*명|store|매장)\s*[:：]?\s*/i, '').trim()
    if (v) return v.slice(0, 60)
  }
  const first = lines.find((l) => l.length >= 2 && !/^[0-9,.\-/]+$/.test(l))
  return first ? first.slice(0, 60) : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!VISION_KEY) return json({ error: 'no_key', message: 'GOOGLE_VISION_API_KEY 미설정' }, 502)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: auth, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !auth?.user) return json({ error: 'unauthorized' }, 401)
  const authId = auth.user.id

  const { data: urow } = await admin.from('users').select('id').eq('auth_id', authId).maybeSingle()
  if (!urow) return json({ error: 'user_not_found' }, 404)
  const userId = urow.id

  let imageBase64 = ''
  let mimeType = 'image/jpeg'
  try {
    const body = await req.json()
    imageBase64 = body.imageBase64
    mimeType = body.mimeType ?? 'image/jpeg'
    if (!imageBase64) throw new Error('imageBase64 required')
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  // 1. Storage 업로드 (폴더 = auth uid)
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
  const path = `${authId}/${Date.now()}.${ext}`
  const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0))
  const up = await admin.storage
    .from('receipt-images')
    .upload(path, bytes, { contentType: mimeType, upsert: false })
  if (up.error) return json({ error: 'storage_failed', detail: up.error.message }, 500)

  // 2. Vision OCR (한국어+영어 힌트)
  let fullText = ''
  try {
    const vres = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${VISION_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: imageBase64 },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
            imageContext: { languageHints: ['ko', 'en'] },
          },
        ],
      }),
    })
    const vjson = await vres.json()
    fullText = vjson?.responses?.[0]?.fullTextAnnotation?.text ?? ''
  } catch (e) {
    return json({ error: 'vision_failed', detail: String(e) }, 502)
  }

  // 3. 휴리스틱 추출
  const totalAmount = parseAmount(fullText)
  const purchaseDate = parseDate(fullText)
  const storeName = parseStore(fullText)
  const ok = totalAmount > 0

  // 4. tax_free_receipts 저장
  const ins = await admin
    .from('tax_free_receipts')
    .insert({
      user_id: userId,
      store_name: storeName,
      purchase_date: purchaseDate,
      total_amount: totalAmount,
      vat_refund: estimateRefund(totalAmount),
      image_path: path,
      raw_text: fullText.slice(0, 2000),
      source: 'scanned',
    })
    .select('id')
    .single()
  if (ins.error || !ins.data)
    return json({ error: 'db_insert_failed', detail: ins.error?.message }, 500)

  return json({
    success: ok,
    receipt_id: ins.data.id,
    data: { storeName, totalAmount, purchaseDate },
    error: ok ? null : 'amount_not_found',
  })
})
