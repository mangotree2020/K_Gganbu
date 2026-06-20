// place-reviews — 장소 리뷰 Edge Function (PLANNING §13, §17)
// Google Places(Find Place → Place Details)로 실제 평점·리뷰를 가져온다.
// 키는 서버 시크릿으로 보호. 리뷰를 언어별로 분리해 한국인(ko)/외국인(non-ko) 관점을 함께 제공.
// 키 미설정/실패 시 mock 폴백(mock-first).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Review = {
  who: string
  flag: string
  score: number
  text: string
  time: string
  lang: string
}
type ReviewsResult = {
  rating: number | null
  total: number
  korean: { score: number; text: string } | null
  foreign: { score: number; text: string } | null
  reviews: Review[]
  provider: 'google' | 'mock'
}

// 리뷰 언어코드 → 국기 이모지
function flagOf(lang: string): string {
  const l = (lang ?? '').toLowerCase()
  if (l.startsWith('ko')) return '🇰🇷'
  if (l === 'zh-tw' || l === 'zh-hk') return '🇹🇼'
  if (l.startsWith('zh')) return '🇨🇳'
  if (l.startsWith('ja')) return '🇯🇵'
  if (l.startsWith('en')) return '🇺🇸'
  if (l.startsWith('vi')) return '🇻🇳'
  if (l.startsWith('th')) return '🇹🇭'
  if (l.startsWith('id')) return '🇮🇩'
  if (l.startsWith('fr')) return '🇫🇷'
  if (l.startsWith('de')) return '🇩🇪'
  if (l.startsWith('es')) return '🇪🇸'
  if (l.startsWith('ru')) return '🇷🇺'
  return '🌐'
}

// 키 미설정/실패 폴백 — 관점별 대표 톤(한국어/영어/일/중)
const MOCK: ReviewsResult = {
  rating: 4.6,
  total: 128,
  korean: { score: 4.6, text: '로컬 분위기 좋고 가성비 최고! 웨이팅 있어도 재방문 의사 있어요.' },
  foreign: { score: 4.5, text: 'Hidden gem — staff spoke some English and the view was amazing.' },
  reviews: [
    {
      who: '민지',
      flag: '🇰🇷',
      score: 5,
      text: '현지인 맛집 인증! 주말엔 웨이팅 있으니 일찍 가세요.',
      time: '2일 전',
      lang: 'ko',
    },
    {
      who: 'Emily',
      flag: '🇺🇸',
      score: 5,
      text: 'Loved the atmosphere. English menu helped a lot!',
      time: '3d ago',
      lang: 'en',
    },
    {
      who: 'たけし',
      flag: '🇯🇵',
      score: 4,
      text: '景色が最高でした。写真スポットとしておすすめ。',
      time: '1週間前',
      lang: 'ja',
    },
    {
      who: '相赫',
      flag: '🇰🇷',
      score: 4,
      text: '가성비 좋아요. 주차가 조금 불편한 점만 빼면 만족.',
      time: '1주 전',
      lang: 'ko',
    },
    {
      who: 'Liwei',
      flag: '🇨🇳',
      score: 5,
      text: '风景很美，交通也方便，推荐！',
      time: '2周前',
      lang: 'zh',
    },
  ],
  provider: 'mock',
}

type GReview = {
  author_name: string
  rating: number
  text: string
  relative_time_description: string
  language?: string
  original_language?: string
  time: number
}

// Place Details 호출 — language 힌트로 해당 언어 리뷰가 상위에 노출되도록 유도
async function fetchDetails(placeId: string, key: string, language: string): Promise<GReview[]> {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}` +
    `&fields=rating,user_ratings_total,reviews&reviews_no_translations=true&language=${language}&key=${key}`
  const res = await fetch(url)
  const data = await res.json()
  return (data.result?.reviews ?? []) as GReview[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    const name: string = body.name ?? ''
    const lat: number | undefined = body.lat
    const lng: number | undefined = body.lng
    const lang: string = body.lang ?? 'en'

    const key = Deno.env.get('GOOGLE_PLACES_API_KEY') ?? Deno.env.get('GOOGLE_MAPS_API_KEY')

    // 키 또는 장소명 미설정 → mock 폴백
    if (!key || !name) {
      return new Response(JSON.stringify(MOCK), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 1) Find Place — 장소명(+좌표 bias)으로 place_id 조회
    const bias = lat != null && lng != null ? `&locationbias=point:${lat},${lng}` : ''
    const findUrl =
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
      `?input=${encodeURIComponent(name)}&inputtype=textquery&fields=place_id${bias}&key=${key}`
    const findRes = await fetch(findUrl)
    const findData = await findRes.json()
    const placeId: string | undefined = findData.candidates?.[0]?.place_id
    if (!placeId) {
      return new Response(JSON.stringify(MOCK), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // 2) Place Details — 한국어/외국어 리뷰 둘 다 확보하기 위해 ko·앱언어 2회 병렬 호출 후 병합
    const detUrl =
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}` +
      `&fields=rating,user_ratings_total,reviews&reviews_no_translations=true&language=ko&key=${key}`
    const [detRes, foreignReviews] = await Promise.all([
      fetch(detUrl).then((r) => r.json()),
      fetchDetails(placeId, key, lang === 'ko' ? 'en' : lang),
    ])
    const result = detRes.result ?? {}
    const koReviews = (result.reviews ?? []) as GReview[]

    // 병합 + 중복 제거(작성자+시간 기준)
    const seen = new Set<string>()
    const merged: GReview[] = []
    for (const r of [...koReviews, ...foreignReviews]) {
      const k = `${r.author_name}|${r.time}`
      if (seen.has(k) || !r.text?.trim()) continue
      seen.add(k)
      merged.push(r)
    }

    const reviews: Review[] = merged.map((r) => {
      const rl = r.original_language ?? r.language ?? ''
      return {
        who: r.author_name,
        flag: flagOf(rl),
        score: r.rating,
        text: r.text.trim(),
        time: r.relative_time_description,
        lang: rl,
      }
    })

    const isKo = (rv: Review) => rv.lang.toLowerCase().startsWith('ko')
    const koTop = reviews.find(isKo) ?? null
    const fgTop = reviews.find((rv) => !isKo(rv)) ?? null

    const out: ReviewsResult = {
      rating: result.rating ?? null,
      total: result.user_ratings_total ?? reviews.length,
      korean: koTop ? { score: koTop.score, text: koTop.text } : null,
      foreign: fgTop ? { score: fgTop.score, text: fgTop.text } : null,
      reviews,
      provider: 'google',
    }
    // 리뷰가 하나도 없으면 mock 폴백(빈 화면 방지)
    if (!reviews.length) {
      return new Response(JSON.stringify(MOCK), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify(out), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ...MOCK, error: String(e) }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
