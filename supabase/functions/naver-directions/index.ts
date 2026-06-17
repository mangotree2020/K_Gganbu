// naver-directions — Naver 길찾기 Edge Function (PLANNING §17, §13)
// Naver Cloud Directions 5 API(자동차 경로). 키는 서버 시크릿으로 보호.
// 경로 좌표 정규화([lng,lat]→{latitude,longitude})와 요약(거리/시간)을 서버에서 처리.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type LatLng = { latitude: number; longitude: number }

// NCP API Gateway 도메인 후보 (신/구) — 계정에 맞는 쪽이 성공
const ENDPOINTS = [
  'https://maps.apigw.ntruss.com/map-direction/v1/driving',
  'https://naveropenapi.apigw.ntruss.com/map-direction/v1/driving',
]

// 직선 보간 mock 경로 (키 미설정/실패 폴백)
function mockRoute(start: LatLng, goal: LatLng) {
  const steps = 12
  const path: LatLng[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    path.push({
      latitude: start.latitude + (goal.latitude - start.latitude) * t,
      longitude: start.longitude + (goal.longitude - start.longitude) * t,
    })
  }
  // 대략 거리(Haversine)
  const R = 6371000
  const dLat = ((goal.latitude - start.latitude) * Math.PI) / 180
  const dLng = ((goal.longitude - start.longitude) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((start.latitude * Math.PI) / 180) *
      Math.cos((goal.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  const distance = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  return { path, distance, duration: Math.round((distance / 1000 / 30) * 3600 * 1000) } // 30km/h 가정
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    const start: LatLng = body.start
    const goal: LatLng = body.goal
    if (!start || !goal) {
      return new Response(JSON.stringify({ error: 'start/goal 필요' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const clientId = Deno.env.get('NAVER_MAPS_CLIENT_ID')
    const clientSecret = Deno.env.get('NAVER_MAPS_CLIENT_SECRET')

    // 키 미설정 → mock 폴백 (mock-first)
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ ...mockRoute(start, goal), provider: 'mock' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const qs = `start=${start.longitude},${start.latitude}&goal=${goal.longitude},${goal.latitude}&option=trafast`
    let lastDetail: unknown = null
    for (const base of ENDPOINTS) {
      try {
        const res = await fetch(`${base}?${qs}`, {
          headers: {
            'x-ncp-apigw-api-key-id': clientId,
            'x-ncp-apigw-api-key': clientSecret,
          },
        })
        const data = await res.json()
        if (!res.ok || data.code !== 0) {
          lastDetail = data.message ?? data.error ?? data
          continue
        }
        const route = data.route?.trafast?.[0]
        if (!route?.path) {
          lastDetail = 'no_path'
          continue
        }
        const path: LatLng[] = route.path.map((p: number[]) => ({
          latitude: p[1],
          longitude: p[0],
        }))
        return new Response(
          JSON.stringify({
            path,
            distance: route.summary?.distance ?? 0,
            duration: route.summary?.duration ?? 0,
            provider: 'naver',
          }),
          { headers: { ...cors, 'Content-Type': 'application/json' } },
        )
      } catch (e) {
        lastDetail = String(e)
      }
    }

    // 모든 엔드포인트 실패 → mock 폴백 + 진단
    return new Response(
      JSON.stringify({ ...mockRoute(start, goal), provider: 'mock', detail: lastDetail }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
