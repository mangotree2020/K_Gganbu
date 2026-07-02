// review-insights — 리뷰 AI 요약 + 언어별 번역 캐시 (PRD REQ-REV-1·2·4, BM§5 S-4)
// 장소×언어 단위로 place_review_insights 에 저장해 사용자 간 재사용(변동비 통제).
// 흐름: 캐시(7일 TTL) 조회 → miss 시 Google 리뷰 + 네이버 블로그 리뷰(공식 검색 API,
//       한국인 관점) 수집 → 마케팅·협찬 사전 필터 → 일괄 번역 → AI 요약(Claude Haiku,
//       양쪽 소스 종합·홍보성 제외 지시) → upsert 저장. 실패 시 mock 폴백.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// 캐시 최신성 정책(2단 TTL + stale-while-revalidate):
//  - 7일 미만: 신선 — 캐시 그대로 반환
//  - 7~30일: 캐시를 즉시 반환하되 백그라운드에서 재생성(사용자 대기 0, 텀 단위 자동 갱신)
//  - 30일 이상/미존재: 동기 재생성(방문이 뜸했던 장소)
const FRESH_MS = 7 * 24 * 60 * 60 * 1000
const STALE_MS = 30 * 24 * 60 * 60 * 1000

type Review = {
  who: string
  flag: string
  score: number
  text: string
  translated: string | null
  time: string
  lang: string
}
type Insights = {
  summary: string
  reviews: Review[]
  rating: number | null
  total: number
  provider: 'live' | 'cache' | 'mock'
  sources?: { google: number; naver: number } // 요약에 반영된 소스별 건수
  placeKey?: string // Google place_id — 외부 지도 딥링크(query_place_id)용
}

// 키 미설정/실패 폴백 — 언어별 샘플 요약
const MOCK_SUMMARY: Record<string, string> = {
  en: 'Travelers love the local vibe and value for money. Staff are friendly to foreigners; expect a short wait on weekends. Parking is limited — walking or transit is easier.',
  ko: '현지 분위기와 가성비가 좋다는 평이 많아요. 직원들이 외국인에게 친절하고, 주말엔 짧은 웨이팅이 있어요. 주차는 불편한 편이라 도보·대중교통 추천.',
  ja: '地元の雰囲気とコスパが好評です。スタッフは外国人に親切で、週末は少し待ちます。駐車場は少ないため徒歩や公共交通がおすすめ。',
  'zh-CN':
    '游客普遍喜欢这里的本地氛围和性价比。店员对外国人很友好，周末可能需要排队。停车位有限，建议步行或乘坐公共交通。',
  'zh-TW':
    '旅客普遍喜歡這裡的在地氛圍與高CP值。店員對外國人很友善，週末可能需要排隊。停車位有限，建議步行或搭乘大眾運輸。',
}

function mockInsights(lang: string): Insights {
  return {
    summary: MOCK_SUMMARY[lang] ?? MOCK_SUMMARY.en,
    reviews: [],
    rating: null,
    total: 0,
    provider: 'mock',
  }
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function flagOf(lang: string): string {
  const l = (lang ?? '').toLowerCase()
  if (l.startsWith('ko')) return '🇰🇷'
  if (l === 'zh-tw' || l === 'zh-hk') return '🇹🇼'
  if (l.startsWith('zh')) return '🇨🇳'
  if (l.startsWith('ja')) return '🇯🇵'
  if (l.startsWith('en')) return '🇺🇸'
  return '🌐'
}

const base = (l: string) => (l ?? '').toLowerCase().split('-')[0]

type GReview = {
  author_name: string
  rating: number
  text: string
  relative_time_description: string
  language?: string
  original_language?: string
  time: number
}

async function fetchDetails(placeId: string, key: string, language: string) {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}` +
    `&fields=rating,user_ratings_total,reviews&reviews_no_translations=true&language=${language}&key=${key}`
  const data = await fetch(url).then((r) => r.json())
  return {
    reviews: (data.result?.reviews ?? []) as GReview[],
    rating: (data.result?.rating ?? null) as number | null,
    total: (data.result?.user_ratings_total ?? 0) as number,
  }
}

// 비대상 언어 리뷰만 일괄 번역 (Google Translation v2 — q 배열 배치)
async function translateBatch(texts: string[], target: string): Promise<string[] | null> {
  const key = Deno.env.get('GOOGLE_TRANSLATION_API_KEY')
  if (!key || !texts.length) return null
  try {
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: texts, target, format: 'text' }),
    })
    const data = await res.json()
    const out = data?.data?.translations?.map((t: { translatedText: string }) => t.translatedText)
    return Array.isArray(out) && out.length === texts.length ? out : null
  } catch {
    return null
  }
}

// 마케팅·협찬성 글 사전 필터 — 명시 표기가 있는 글은 요약 입력에서 제외
const SPONSORED =
  /협찬|체험단|원고료|소정의|제공\s?받|광고\s?포스트|서포터즈|무상\s?(제공|지원)|업체로부터|파트너스\s?활동/

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

// 네이버 블로그 리뷰(한국인 관점) — 공식 검색 API 사용(REV-3 약관 준수 경로).
// 키 미설정/실패 시 빈 배열(요약은 Google 리뷰만으로 진행).
async function fetchNaverBlog(name: string): Promise<string[]> {
  const id = Deno.env.get('NAVER_SEARCH_CLIENT_ID') ?? Deno.env.get('NAVER_CLIENT_ID')
  const secret = Deno.env.get('NAVER_SEARCH_CLIENT_SECRET') ?? Deno.env.get('NAVER_CLIENT_SECRET')
  if (!id || !secret) return []
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(`${name} 후기`)}&display=10&sort=sim`,
      { headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret } },
    )
    const data = await res.json()
    return ((data.items ?? []) as { title: string; description: string }[])
      .map((it) => stripHtml(`${it.title} — ${it.description}`))
      .filter((t) => t.length > 20 && !SPONSORED.test(t))
      .slice(0, 6)
  } catch {
    return []
  }
}

const LANG_NAME: Record<string, string> = {
  en: 'English',
  ko: 'Korean',
  ja: 'Japanese',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
}

// AI 요약 — 저비용 Haiku 사용 (BM§3.3 모델 티어링). 실패 시 빈 문자열.
// Google(외국인 여행자)·네이버 블로그(한국인 현지) 양쪽 소스를 종합하고,
// 홍보·광고·협찬성으로 보이는 내용은 요약에서 제외하도록 지시한다.
async function summarize(
  name: string,
  reviews: Review[],
  naverPosts: string[],
  lang: string,
): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey || (!reviews.length && !naverPosts.length)) return ''
  const googleCorpus = reviews
    .slice(0, 10)
    .map((r) => `- (${r.score}/5) ${r.text}`)
    .join('\n')
  const naverCorpus = naverPosts.map((t) => `- ${t}`).join('\n')
  const corpus =
    (googleCorpus ? `[Google reviews — mostly travelers, with ratings]\n${googleCorpus}\n\n` : '') +
    (naverCorpus ? `[Naver blog posts — Korean locals' perspective]\n${naverCorpus}` : '')
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content:
              `Summarize customer feedback about "${name}" (a place in Korea) for a foreign traveler.\n` +
              `Consider BOTH sources below — travelers' Google reviews AND Korean locals' Naver blog posts — ` +
              `and blend the two perspectives when they differ.\n` +
              `IMPORTANT: Ignore anything that reads like marketing, advertising, or a sponsored post ` +
              `(exaggerated promotional tone, event/discount announcements, copy written by the business). ` +
              `Base the summary only on authentic customer experiences.\n` +
              `Write in ${LANG_NAME[lang] ?? 'English'}. 2-3 short sentences covering overall vibe, ` +
              `what stands out, and one practical caution if any. Plain text only, no headings.\n\n${corpus}`,
          },
        ],
      }),
    })
    const data = await res.json()
    return (data?.content?.[0]?.text ?? '').trim()
  } catch {
    return ''
  }
}

// 수집→번역→요약→저장 전체 파이프라인 — 동기 응답과 백그라운드 갱신이 공용
async function generateAndStore(
  admin: ReturnType<typeof createClient>,
  placeId: string,
  name: string,
  lang: string,
  key: string,
): Promise<Insights | null> {
  // 리뷰 수집 — Google(ko+앱 언어) + 네이버 블로그(한국인 관점, 협찬 필터) 병렬
  const [koRes, fgRes, naverPosts] = await Promise.all([
    fetchDetails(placeId, key, 'ko'),
    fetchDetails(placeId, key, base(lang) === 'ko' ? 'en' : lang),
    fetchNaverBlog(name),
  ])
  const seen = new Set<string>()
  const merged: GReview[] = []
  for (const r of [...koRes.reviews, ...fgRes.reviews]) {
    const k = `${r.author_name}|${r.time}`
    if (seen.has(k) || !r.text?.trim()) continue
    seen.add(k)
    merged.push(r)
  }
  if (!merged.length && !naverPosts.length) return null

  const reviews: Review[] = merged.map((r) => {
    const rl = r.original_language ?? r.language ?? ''
    return {
      who: r.author_name,
      flag: flagOf(rl),
      score: r.rating,
      text: r.text.trim(),
      translated: null,
      time: r.relative_time_description,
      lang: rl,
    }
  })

  // 비대상 언어 리뷰 일괄 번역 (1회 API 호출)
  const needIdx = reviews
    .map((r, i) => (base(r.lang) !== base(lang) ? i : -1))
    .filter((i) => i >= 0)
  const translations = await translateBatch(
    needIdx.map((i) => reviews[i].text),
    lang,
  )
  if (translations) needIdx.forEach((ri, j) => (reviews[ri].translated = translations[j]))

  // AI 요약 — Google+네이버 양쪽 소스 종합, 홍보성 제외
  const summary = await summarize(name, reviews, naverPosts, lang)

  const out: Insights = {
    summary,
    reviews,
    rating: koRes.rating ?? fgRes.rating,
    total: koRes.total || fgRes.total || reviews.length,
    provider: 'live',
    sources: { google: reviews.length, naver: naverPosts.length },
    placeKey: placeId,
  }

  // 저장(upsert) — 요약·번역 중 하나라도 생성됐을 때만 (빈 캐시 방지)
  if (summary || translations) {
    await admin.from('place_review_insights').upsert(
      {
        place_key: placeId,
        lang,
        summary: out.summary,
        reviews: out.reviews,
        rating: out.rating,
        total: out.total,
        sources: out.sources,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'place_key,lang' },
    )
  }
  return out
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
    if (!key || !name) return json(mockInsights(lang))

    // 1) Find Place — 안정 캐시 키(place_id) 확보
    const bias = lat != null && lng != null ? `&locationbias=point:${lat},${lng}` : ''
    const findUrl =
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
      `?input=${encodeURIComponent(name)}&inputtype=textquery&fields=place_id${bias}&key=${key}`
    const placeId: string | undefined = (await fetch(findUrl).then((r) => r.json())).candidates?.[0]
      ?.place_id
    if (!placeId) return json(mockInsights(lang))

    // 2) 캐시 조회 — 2단 TTL(신선 7일 / stale 30일) + stale-while-revalidate
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: cached } = await admin
      .from('place_review_insights')
      .select('summary, reviews, rating, total, sources, updated_at')
      .eq('place_key', placeId)
      .eq('lang', lang)
      .maybeSingle()
    if (cached) {
      const age = Date.now() - new Date(cached.updated_at).getTime()
      if (age < STALE_MS) {
        // 7~30일 구간이면 백그라운드 재생성 예약(응답은 기다리지 않음) — 최신성 자동 확보
        if (age >= FRESH_MS) {
          // deno-lint-ignore no-explicit-any
          const rt = (globalThis as any).EdgeRuntime
          const refresh = generateAndStore(admin, placeId, name, lang, key).catch(() => null)
          if (rt?.waitUntil) rt.waitUntil(refresh)
        }
        return json({
          summary: cached.summary,
          reviews: cached.reviews,
          rating: cached.rating,
          total: cached.total,
          provider: 'cache',
          sources: cached.sources ?? undefined,
          placeKey: placeId,
        } satisfies Insights)
      }
      // 30일 초과 — 아래에서 동기 재생성
    }

    // 3) 캐시 없음/만료 — 동기 생성
    const out = await generateAndStore(admin, placeId, name, lang, key)
    return json(out ?? mockInsights(lang))
  } catch (e) {
    return json({ ...mockInsights('en'), error: String(e) })
  }
})
