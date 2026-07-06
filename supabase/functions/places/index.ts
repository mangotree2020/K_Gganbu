// places — 한국관광공사 TourAPI 4.0 기반 POI 조회 (다국어)
// 부산(areaCode=6) 지역 기반 관광지/음식점 실데이터. 키는 서버 시크릿으로 보호.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 언어별 TourAPI 서비스명
const SERVICE: Record<string, string> = {
  ko: 'KorService2',
  en: 'EngService2',
  ja: 'JpnService2',
  'zh-CN': 'ChsService2',
  'zh-TW': 'ChtService2',
}

// contentTypeId: 12=관광지, 39=음식점, 14=문화시설, 15=축제
type Body = { lang?: string; areaCode?: number; contentTypeId?: number; rows?: number }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const key = Deno.env.get('TOUR_API_KEY')
    if (!key) {
      return new Response(JSON.stringify({ error: 'no_key', message: 'TourAPI 키 미설정' }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const {
      lang = 'en',
      areaCode = 6,
      contentTypeId,
      rows = 20,
    }: Body = req.method === 'POST' ? await req.json() : {}
    const service = SERVICE[lang] ?? SERVICE.en

    const params = new URLSearchParams({
      serviceKey: decodeURIComponent(key),
      areaCode: String(areaCode),
      numOfRows: String(rows),
      pageNo: '1',
      MobileOS: 'ETC',
      MobileApp: 'KGganbu',
      _type: 'json',
      arrange: 'O', // 대표이미지 있는 항목 우선
    })
    if (contentTypeId) params.set('contentTypeId', String(contentTypeId))

    const url = `https://apis.data.go.kr/B551011/${service}/areaBasedList2?${params}`
    const res = await fetch(url)
    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'tourapi_error', status: res.status }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const json = await res.json()
    const items = json?.response?.body?.items?.item ?? []
    const places = (Array.isArray(items) ? items : [items]).map((it: Record<string, string>) => ({
      id: it.contentid,
      name: it.title,
      address: it.addr1,
      lat: Number(it.mapy) || null,
      lng: Number(it.mapx) || null,
      // TourAPI firstimage 는 http:// 로 내려옴 — RN 은 cleartext 차단(iOS ATS·Android 9+ release)이라 https 승격
      imageUrl: it.firstimage ? it.firstimage.replace(/^http:\/\//, 'https://') : null,
      tel: it.tel || null,
      contentTypeId: it.contenttypeid,
    }))

    return new Response(JSON.stringify({ places, count: places.length, lang, service }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
