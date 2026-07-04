// place-lookup — 지도 탭 → 장소 정보 변환 Edge Function (REQ-MAP, K-Map §17)
// ① Google 지도 POI 클릭: placeId → Place Details(이름·좌표·주소·평점)
// ② Naver 지도 탭: 좌표 → Nearby Search(최근접 시설) — 클라이언트가 60m 게이트로 빈 지도 탭 무시
// 키는 서버 시크릿(GOOGLE_PLACES_API_KEY) 보호. 실패 시 null 반환(클라이언트 조용히 무시).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

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

// Google place types → 앱 카테고리(PlaceThumb 키)
function toCat(types: string[] = []): string {
  const has = (...ts: string[]) => ts.some((t) => types.includes(t))
  if (has('cafe', 'bakery')) return 'cafe'
  if (has('restaurant', 'meal_takeaway', 'meal_delivery', 'food')) return 'food'
  if (has('lodging')) return 'stay'
  if (has('shopping_mall', 'department_store', 'store', 'supermarket', 'convenience_store'))
    return 'shopping'
  if (has('museum', 'art_gallery', 'movie_theater', 'library')) return 'culture'
  if (has('amusement_park', 'aquarium', 'zoo', 'stadium', 'gym', 'spa')) return 'leisure'
  if (has('natural_feature', 'park', 'campground')) return 'sights'
  return 'sights'
}

// 지명·행정구역 등 "시설이 아닌" 결과는 건너뛴다(빈 지도 탭 시 동네 이름이 뜨는 것 방지)
const NON_PLACE = new Set([
  'political',
  'locality',
  'sublocality',
  'sublocality_level_1',
  'sublocality_level_2',
  'neighborhood',
  'postal_code',
  'route',
  'country',
  'administrative_area_level_1',
  'administrative_area_level_2',
])
function isEstablishment(types: string[] = []): boolean {
  if (!types.length) return false
  return !types.every((t) => NON_PLACE.has(t) || t === 'geocode')
}

type Out = {
  id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  imageUrl: string | null
  tel: string | null
  cat: string
  rating: number | null
  placeId: string
}

// deno-lint-ignore no-explicit-any
function toOut(r: any): Out | null {
  const loc = r?.geometry?.location
  if (!r?.name || !loc) return null
  return {
    id: `g:${r.place_id}`,
    name: r.name,
    address: r.formatted_address ?? r.vicinity ?? null,
    lat: loc.lat,
    lng: loc.lng,
    imageUrl: null, // photo URL은 키가 노출되므로 미제공 — 클라이언트는 카테고리 썸네일 사용
    tel: r.formatted_phone_number ?? null,
    cat: toCat(r.types),
    rating: r.rating ?? null,
    placeId: r.place_id,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    const placeId: string | undefined = body.placeId
    const lat: number | undefined = body.lat
    const lng: number | undefined = body.lng
    const lang: string = body.lang ?? 'en'
    const key = Deno.env.get('GOOGLE_PLACES_API_KEY') ?? Deno.env.get('GOOGLE_MAPS_API_KEY')
    if (!key) return json({ error: 'no_key' }, 502)

    // ⓪ 이름 → 장소 대표 사진 URL (Find Place → Photo 302 추적으로 키 없는 lh3 URL 확보)
    const photoName: string | undefined = body.photoName
    if (photoName) {
      const findUrl =
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
        `?input=${encodeURIComponent(photoName)}&inputtype=textquery&fields=photos&key=${key}`
      const fd = await fetch(findUrl).then((r) => r.json())
      const ref: string | undefined = fd.candidates?.[0]?.photos?.[0]?.photo_reference
      if (!ref) return json({ url: null })
      const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=320&photoreference=${ref}&key=${key}`
      const pr = await fetch(photoUrl, { redirect: 'manual' })
      const loc = pr.headers.get('location')
      return json({ url: loc ?? null })
    }

    // ⓪′ 텍스트 검색 (쿠폰 매장 등 이름 → 좌표·주소·평점) — Find Place
    const query: string | undefined = body.query
    if (query) {
      const url =
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
        `?input=${encodeURIComponent(query)}&inputtype=textquery` +
        `&fields=place_id,name,geometry/location,formatted_address,types,rating` +
        `&language=${lang}&key=${key}`
      const data = await fetch(url).then((r) => r.json())
      const out = toOut(data.candidates?.[0])
      return json(out ?? { error: 'not_found' }, out ? 200 : 404)
    }

    // ① placeId 직접 조회 (Google POI 탭)
    if (placeId) {
      const url =
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}` +
        `&fields=place_id,name,geometry/location,formatted_address,formatted_phone_number,rating,types` +
        `&language=${lang}&key=${key}`
      const data = await fetch(url).then((r) => r.json())
      const out = toOut(data.result)
      return json(out ?? { error: 'not_found' }, out ? 200 : 404)
    }

    // ② 좌표 최근접 조회 (Naver 지도 탭) — 탭 지점 반경 70m 내 시설 중 최근접.
    // rankby=distance는 type/keyword 필수라 radius 방식 사용(빈 지도 탭이면 자연히 결과 없음).
    if (lat != null && lng != null) {
      const url =
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}` +
        `&radius=70&language=${lang}&key=${key}`
      const data = await fetch(url).then((r) => r.json())
      const distM = (a: { lat: number; lng: number }) => {
        const dLat = ((a.lat - lat) * Math.PI) / 180
        const dLng = ((a.lng - lng) * Math.PI) / 180
        const s =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat * Math.PI) / 180) *
            Math.cos((a.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2
        return 6371000 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
      }
      const first = (data.results ?? [])
        // deno-lint-ignore no-explicit-any
        .filter((r: any) => isEstablishment(r.types) && r.geometry?.location)
        // deno-lint-ignore no-explicit-any
        .sort((a: any, b: any) => distM(a.geometry.location) - distM(b.geometry.location))[0]
      const out = toOut(first)
      return json(out ?? { error: 'not_found' }, out ? 200 : 404)
    }

    return json({ error: 'placeId 또는 lat/lng 필수' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
