// passport-ocr (#26) — 여권 이미지 → Google Vision OCR → MRZ(TD3) 파싱 → DB 저장.
// 쓰기는 service role(RLS 우회). 클라이언트는 본인 access_token으로 호출.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const VISION_KEY = Deno.env.get('GOOGLE_VISION_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

// ── MRZ TD3 (여권) 파서 — 2줄 × 44자 ──────────────────────────────────────────
function charVal(c: string): number {
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55 // A=10
  return 0 // '<'
}
function checkDigit(s: string): number {
  const w = [7, 3, 1]
  let sum = 0
  for (let i = 0; i < s.length; i++) sum += charVal(s[i]) * w[i % 3]
  return sum % 10
}
// YYMMDD → ISO. isExpiry면 20xx, 아니면 yy>30 → 19xx(생년월일).
function fmtDate(yymmdd: string, isExpiry: boolean): string | null {
  if (!/^[0-9]{6}$/.test(yymmdd)) return null
  const yy = parseInt(yymmdd.slice(0, 2), 10)
  const mm = yymmdd.slice(2, 4)
  const dd = yymmdd.slice(4, 6)
  const yyyy = isExpiry ? 2000 + yy : yy > 30 ? 1900 + yy : 2000 + yy
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return null
  return `${yyyy}-${mm}-${dd}`
}

type Parsed = {
  surname: string
  given: string
  nationality: string
  passportNumber: string
  birthDate: string | null
  sex: string
  expiryDate: string | null
  personalNumber: string | null
  valid: boolean
}

function parseTD3(l1: string, l2: string): Parsed {
  // Line 1: P<ISS<SURNAME<<GIVEN<NAMES
  const namePart = l1.slice(5).replace(/<+$/, '')
  const [sur, giv] = namePart.split('<<')
  const surname = (sur || '').replace(/</g, ' ').trim()
  const given = (giv || '').replace(/</g, ' ').trim()
  // Line 2
  const passportNumber = l2.slice(0, 9).replace(/</g, '')
  const pnCd = parseInt(l2[9], 10)
  const nationality = l2.slice(10, 13).replace(/</g, '')
  const birth = l2.slice(13, 19)
  const birthCd = parseInt(l2[19], 10)
  const sex = l2[20]
  const expiry = l2.slice(21, 27)
  const expiryCd = parseInt(l2[27], 10)
  const personal = l2.slice(28, 42)
  const personalCd = parseInt(l2[42], 10)
  const compositeCd = parseInt(l2[43], 10)
  // 체크 디지트 검증
  const okPn = checkDigit(l2.slice(0, 9)) === pnCd
  const okBirth = checkDigit(birth) === birthCd
  const okExpiry = checkDigit(expiry) === expiryCd
  const composite = l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 28) + l2.slice(28, 43)
  const okComposite = checkDigit(composite) === compositeCd
  // personalCd: 개인번호 미사용(<<<) 여권 다수 → 검증에서 제외(참고용)
  void personalCd
  const valid = okPn && okBirth && okExpiry && okComposite
  return {
    surname,
    given,
    nationality,
    passportNumber,
    birthDate: fmtDate(birth, false),
    sex: sex === 'M' || sex === 'F' ? sex : 'X',
    expiryDate: fmtDate(expiry, true),
    personalNumber: personal.replace(/</g, '') || null,
    valid,
  }
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

  // public.users.id 매핑(테이블 user_id 규약)
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
    .from('passport-images')
    .upload(path, bytes, { contentType: mimeType, upsert: false })
  if (up.error) return json({ error: 'storage_failed', detail: up.error.message }, 500)

  // 2. scan 레코드(pending)
  const ins = await admin
    .from('passport_scans')
    .insert({ user_id: userId, image_path: path, status: 'pending' })
    .select('id')
    .single()
  if (ins.error || !ins.data) return json({ error: 'db_insert_failed' }, 500)
  const scanId = ins.data.id

  // 3. Vision OCR
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
            imageContext: { languageHints: ['en'] },
          },
        ],
      }),
    })
    const vjson = await vres.json()
    fullText = vjson?.responses?.[0]?.fullTextAnnotation?.text ?? ''
  } catch (e) {
    await admin
      .from('passport_scans')
      .update({ status: 'failed', error_message: 'vision_failed' })
      .eq('id', scanId)
    return json({ error: 'vision_failed', scan_id: scanId, detail: String(e) }, 502)
  }

  // 4. MRZ 2줄 추출
  const lines = fullText.split('\n').map((l: string) => l.trim().replace(/\s+/g, '').toUpperCase())
  const mrz = lines.filter((l: string) => /^[A-Z0-9<]{44}$/.test(l))

  let parsed: Parsed | null = null
  let parseError: string | null = null
  if (mrz.length >= 2) {
    try {
      parsed = parseTD3(mrz[mrz.length - 2], mrz[mrz.length - 1])
    } catch (e) {
      parseError = `mrz_parse_error: ${String(e)}`
    }
  } else {
    parseError = `mrz_not_found (lines=${mrz.length})`
  }

  // 5. scan 업데이트
  await admin
    .from('passport_scans')
    .update({
      raw_mrz: mrz.slice(-2).join('\n') || null,
      status: parsed ? 'success' : 'failed',
      error_message: parseError,
    })
    .eq('id', scanId)

  // 6. passport_data 저장
  if (parsed) {
    await admin.from('passport_data').insert({
      scan_id: scanId,
      user_id: userId,
      surname: parsed.surname || null,
      given_name: parsed.given || null,
      nationality: parsed.nationality || null,
      passport_number: parsed.passportNumber || null,
      date_of_birth: parsed.birthDate,
      sex: parsed.sex,
      expiry_date: parsed.expiryDate,
      personal_number: parsed.personalNumber,
      is_valid: parsed.valid,
    })
  }

  return json({
    success: !!parsed,
    scan_id: scanId,
    is_valid: parsed?.valid ?? false,
    data: parsed,
    error: parseError,
  })
})
