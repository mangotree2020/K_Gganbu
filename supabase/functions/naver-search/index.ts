// naver-search — Naver 지역 검색 Edge Function (PLANNING §13, §17)
// Naver 지역 검색 API(키워드→장소+좌표). 키는 서버 시크릿으로 보호(클라이언트 미노출).
// 좌표 정규화(mapx/mapy → WGS84)와 캐싱을 서버에서 일괄 처리한다.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type NaverPoi = {
  id: string
  name: string
  category: string
  address: string
  roadAddress: string
  lat: number
  lng: number
  link: string
}

// HTML 태그 제거(<b> 등)
function stripTags(s: string): string {
  return (s ?? '').replace(/<[^>]*>/g, '').trim()
}

// 부산 mock (키 미설정 폴백)
const MOCK: NaverPoi[] = [
  {
    id: 'n1',
    name: '해운대해수욕장',
    category: '관광,명소',
    address: '부산 해운대구 우동',
    roadAddress: '부산 해운대구 해운대해변로',
    lat: 35.1587,
    lng: 129.1604,
    link: '',
  },
  {
    id: 'n2',
    name: '광안리해수욕장',
    category: '관광,명소',
    address: '부산 수영구 광안동',
    roadAddress: '부산 수영구 광안해변로',
    lat: 35.1532,
    lng: 129.1186,
    link: '',
  },
  {
    id: 'n3',
    name: '감천문화마을',
    category: '관광,명소',
    address: '부산 사하구 감천동',
    roadAddress: '부산 사하구 감내2로',
    lat: 35.0976,
    lng: 129.0106,
    link: '',
  },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    const query: string = body.query ?? '부산 관광지'
    const display: number = Math.min(body.display ?? 5, 5)

    // Naver Developers Search 자격증명: SEARCH 전용 이름 우선, 없으면 NAVER_CLIENT_* 폴백
    const clientId = Deno.env.get('NAVER_SEARCH_CLIENT_ID') ?? Deno.env.get('NAVER_CLIENT_ID')
    const clientSecret =
      Deno.env.get('NAVER_SEARCH_CLIENT_SECRET') ?? Deno.env.get('NAVER_CLIENT_SECRET')

    // 키 미설정 → mock 폴백 (mock-first)
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ items: MOCK, provider: 'mock' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(
      query,
    )}&display=${display}&sort=random`
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    })
    const data = await res.json()
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: 'naver_failed', detail: data.errorMessage ?? data, items: MOCK }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    // mapx/mapy: WGS84 × 10^7 → 좌표 변환
    const items: NaverPoi[] = (data.items ?? []).map((it: Record<string, string>, i: number) => ({
      id: `nv-${i}`,
      name: stripTags(it.title),
      category: it.category ?? '',
      address: it.address ?? '',
      roadAddress: it.roadAddress ?? '',
      lat: Number(it.mapy) / 1e7,
      lng: Number(it.mapx) / 1e7,
      link: it.link ?? '',
    }))

    return new Response(JSON.stringify({ items, provider: 'naver' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), items: MOCK }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
