// naver-directions — 길찾기 Edge Function (PLANNING §17, §13)
// 여행자 이동은 도보가 기본 — **도보 경로 우선** 정책:
//   1순위 Tmap 보행자 경로(SK오픈API, TMAP_APP_KEY) — 국내 유일한 실 보행자 라우팅
//     · 무료 쿼터 일 1,000건 — 초과(429)·장애·지연(타임아웃 4초) 시 아래로 자동 폴백.
//       실서비스 트래픽 도달 전 종량제 전환 필요(SETUP_EXTERNAL) — 일 사용량을
//       usage_counters(kind=tmap_route, 글로벌)로 관측해 전환 시점을 판단한다.
//   2순위 Google Routes API(WALK) — 해외 좌표 전용. **한국은 규제로 WALK 미제공(빈 응답) 확인(2026-07-07)**
//   3순위 Naver Cloud Directions 5(자동차 경로) 폴백 — 시간은 도보 속도로 재계산
//   4순위 직선 보간 mock
// 어떤 단계가 실패해도 길찾기 응답은 반드시 반환된다(무응답 없음).
// Naver Cloud 에는 보행자 경로 API 가 없다.
// 경로 좌표 정규화와 요약(거리 m/시간 ms)을 서버에서 처리, 응답 mode 로 산출 방식 표기.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type LatLng = { latitude: number; longitude: number }

// 도보 속도 — 여행자 평균 4.5km/h(짐·사진 포함 보수치)
const WALK_SPEED_M_PER_MS = 4500 / 3600 / 1000

// NCP API Gateway 도메인 — 신형만 사용(구형 naveropenapi.apigw.ntruss.com은 2026-06-25 종료로 제거)
const NAVER_ENDPOINTS = ['https://maps.apigw.ntruss.com/map-direction/v1/driving']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// Google encoded polyline 디코더 (precision 5)
function decodePolyline(encoded: string): LatLng[] {
  const path: LatLng[] = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
    for (const which of [0, 1] as const) {
      let result = 0
      let shift = 0
      let b: number
      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (which === 0) lat += delta
      else lng += delta
    }
    path.push({ latitude: lat / 1e5, longitude: lng / 1e5 })
  }
  return path
}

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)))
}

// 직선 보간 mock 경로 (키 미설정/전체 실패 폴백) — 시간은 도보 기준
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
  const distance = haversine(start, goal)
  return { path, distance, duration: Math.round(distance / WALK_SPEED_M_PER_MS), mode: 'walk' }
}

// 한국 좌표 여부 — Google WALK 는 한국에서 항상 빈 응답이므로 국내에선 호출 자체를 생략
function inKorea(p: LatLng): boolean {
  return p.latitude >= 33 && p.latitude <= 39 && p.longitude >= 124 && p.longitude <= 132
}

// Tmap 일 사용량 관측 (무료 쿼터 1,000건/일 — 종량제 전환 시점 판단용, 실패는 무시)
// usage_counters 는 (user_id, day, kind) PK — 글로벌 카운터로 zero-uuid 사용.
function countTmapUsage() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return
  const p = fetch(`${url}/rest/v1/rpc/bump_usage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      p_user: '00000000-0000-0000-0000-000000000000',
      p_kind: 'tmap_route',
    }),
  }).catch(() => {})
  // 응답을 기다리지 않고 백그라운드로 — 길찾기 지연 없음
  try {
    // deno-lint-ignore no-explicit-any
    ;(globalThis as any).EdgeRuntime?.waitUntil?.(p)
  } catch {
    // waitUntil 미지원 환경 — fire-and-forget
  }
}

// 1순위 — Tmap 보행자 경로 (SK오픈API)
async function tmapWalkRoute(start: LatLng, goal: LatLng, appKey: string) {
  const res = await fetch('https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', appKey },
    signal: AbortSignal.timeout(4000), // 장애·지연 시 4초 내 Naver 폴백
    body: JSON.stringify({
      startX: String(start.longitude),
      startY: String(start.latitude),
      endX: String(goal.longitude),
      endY: String(goal.latitude),
      reqCoordType: 'WGS84GEO',
      resCoordType: 'WGS84GEO',
      startName: encodeURIComponent('출발'),
      endName: encodeURIComponent('도착'),
    }),
  })
  const data = await res.json()
  const features = data?.features
  if (!res.ok || !Array.isArray(features) || !features.length) {
    throw new Error(data?.error?.message ?? 'tmap_no_route')
  }
  const path: LatLng[] = []
  let distance = 0
  let durationSec = 0
  for (const f of features) {
    if (f.geometry?.type === 'LineString') {
      for (const c of f.geometry.coordinates as number[][]) {
        path.push({ latitude: c[1], longitude: c[0] })
      }
    }
    // 총 거리·시간은 첫 Point feature 의 properties 에 실려 온다
    if (f.properties?.totalDistance) distance = f.properties.totalDistance
    if (f.properties?.totalTime) durationSec = f.properties.totalTime
  }
  if (!path.length) throw new Error('tmap_empty_path')
  return {
    path,
    distance,
    duration: durationSec > 0 ? durationSec * 1000 : Math.round(distance / WALK_SPEED_M_PER_MS),
    provider: 'tmap',
    mode: 'walk',
  }
}

// 2순위 — Google Routes API 도보 경로 (해외 좌표 전용)
async function googleWalkRoute(start: LatLng, goal: LatLng, key: string) {
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: start.latitude, longitude: start.longitude } } },
      destination: { location: { latLng: { latitude: goal.latitude, longitude: goal.longitude } } },
      travelMode: 'WALK',
    }),
  })
  const data = await res.json()
  const route = data?.routes?.[0]
  if (!res.ok || !route?.polyline?.encodedPolyline) {
    throw new Error(data?.error?.message ?? 'no_walk_route')
  }
  const path = decodePolyline(route.polyline.encodedPolyline)
  const distance = route.distanceMeters ?? 0
  // duration 은 "123s" 형태 → ms. 없으면 도보 속도로 추정
  const sec = Number(String(route.duration ?? '').replace('s', ''))
  const duration =
    Number.isFinite(sec) && sec > 0 ? sec * 1000 : Math.round(distance / WALK_SPEED_M_PER_MS)
  return { path, distance, duration, provider: 'google', mode: 'walk' }
}

// 3순위 — Naver 자동차 경로 폴백 (도로를 따르는 경로 확보, 시간은 도보 속도로 재계산)
async function naverDriveRoute(start: LatLng, goal: LatLng, id: string, secret: string) {
  const qs = `start=${start.longitude},${start.latitude}&goal=${goal.longitude},${goal.latitude}&option=trafast`
  let lastDetail: unknown = null
  for (const base of NAVER_ENDPOINTS) {
    try {
      const res = await fetch(`${base}?${qs}`, {
        headers: { 'x-ncp-apigw-api-key-id': id, 'x-ncp-apigw-api-key': secret },
        signal: AbortSignal.timeout(5000), // 지연 시 mock 폴백으로 — 무응답 방지
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
      const path: LatLng[] = route.path.map((p: number[]) => ({ latitude: p[1], longitude: p[0] }))
      const distance = route.summary?.distance ?? 0
      return {
        path,
        distance,
        // 자동차 소요시간 대신 도보 기준으로 재계산 (도보 우선 정책)
        duration: Math.round(distance / WALK_SPEED_M_PER_MS),
        provider: 'naver',
        mode: 'walk-estimated',
      }
    } catch (e) {
      lastDetail = String(e)
    }
  }
  throw new Error(String(lastDetail))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    const start: LatLng = body.start
    const goal: LatLng = body.goal
    if (!start || !goal) return json({ error: 'start/goal 필요' }, 400)

    const tmapKey = Deno.env.get('TMAP_APP_KEY')
    const googleKey = Deno.env.get('GOOGLE_PLACES_API_KEY') ?? Deno.env.get('GOOGLE_MAPS_API_KEY')
    // NCP 자격증명: MAPS 전용 이름 우선, 없으면 정식 NAVER_CLIENT_* 로 폴백
    const naverId = Deno.env.get('NAVER_MAPS_CLIENT_ID') ?? Deno.env.get('NAVER_CLIENT_ID')
    const naverSecret =
      Deno.env.get('NAVER_MAPS_CLIENT_SECRET') ?? Deno.env.get('NAVER_CLIENT_SECRET')

    let walkDetail: unknown = null
    if (tmapKey) {
      countTmapUsage() // 쿼터는 성공·실패 무관 호출 단위로 소진 — 시도 기준 집계
      try {
        return json(await tmapWalkRoute(start, goal, tmapKey))
      } catch (e) {
        walkDetail = String(e)
      }
    }
    // Google WALK 는 한국 좌표에서 항상 빈 응답(규제) — 해외 좌표에서만 시도
    if (googleKey && !(inKorea(start) && inKorea(goal))) {
      try {
        return json(await googleWalkRoute(start, goal, googleKey))
      } catch (e) {
        walkDetail = `${walkDetail ?? ''} / ${String(e)}`
      }
    }
    if (naverId && naverSecret) {
      try {
        const r = await naverDriveRoute(start, goal, naverId, naverSecret)
        return json({ ...r, detail: walkDetail })
      } catch (e) {
        walkDetail = `${walkDetail} / ${String(e)}`
      }
    }
    return json({ ...mockRoute(start, goal), provider: 'mock', detail: walkDetail })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
