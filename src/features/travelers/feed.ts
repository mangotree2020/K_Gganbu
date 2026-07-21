// 여행자 후기 피드 데이터 — 인스타 스타일 포스트(리뷰글 + 이미지 + 좋아요/댓글/공유).
// 실 TourAPI POI(이미지·좌표 보유)를 결정론적으로 포스트로 합성한다(mock-first).
// 실 reviews 테이블 연동 시 buildTravelerFeed를 서버 데이터 매핑으로 교체하면 된다.
import type { Poi } from '@/features/map/queries'

export type MediaItem = { type: 'image' | 'video'; uri: string; poster?: string }

export type TravelerPost = {
  id: string
  author: string
  flag: string
  text: string // 리뷰 본문(캡션)
  media: MediaItem[] // 이미지 여러 장 + 영상(가로 캐러셀)
  place: string
  cat: string // PlaceThumb 폴백 카테고리
  lat: number | null
  lng: number | null
  ageMin: number // 작성 경과(분) — 시간 정렬용(작을수록 최신)
  dist: number // 현재 위치로부터 거리(km) — 거리 정렬용
  likes: number // 기본 좋아요 수(내 좋아요는 store에서 가산)
  seedComments: number // 기본 댓글 수(내 댓글은 store에서 가산)
}

// 데모용 샘플 영상(공개 mp4) — 실 후기 연동 시 사용자 업로드 URL로 교체
const SAMPLE_VIDEOS = [
  'https://download.samplelib.com/mp4/sample-5s.mp4',
  'https://download.samplelib.com/mp4/sample-10s.mp4',
]

// 다국적 여행자 풀(§4 타깃: ja/zh/tw + 영어권/동남아)
const AUTHORS: { name: string; flag: string }[] = [
  { name: 'Yuki', flag: '🇯🇵' },
  { name: 'Sora', flag: '🇯🇵' },
  { name: 'Haru', flag: '🇯🇵' },
  { name: 'Mei', flag: '🇹🇼' },
  { name: 'Wei', flag: '🇨🇳' },
  { name: 'Lin', flag: '🇨🇳' },
  { name: 'Alex', flag: '🇺🇸' },
  { name: 'Emma', flag: '🇬🇧' },
  { name: 'Liam', flag: '🇦🇺' },
  { name: 'Nadia', flag: '🇮🇩' },
  { name: 'Minh', flag: '🇻🇳' },
  { name: 'Chloe', flag: '🇫🇷' },
]

// 카테고리별 캡션 템플릿(UGC 성격의 영어 후기 — 다국적 여행자 톤)
const CAPTIONS: Record<string, string[]> = {
  food: [
    'Best meal of the trip 😋 Staff were so kind with the translation card.',
    'Hidden gem for local food — came back twice in one day!',
    'Portion was huge and the banchan kept coming. Loved it.',
  ],
  cafe: [
    'Perfect ocean-view coffee break ☕ QR menu had English too.',
    'Aesthetic cafe, great for photos. A bit busy on weekends.',
  ],
  sights: [
    'So photogenic — allow at least 1.5h. Wear comfy shoes 👟',
    'The view was unreal at sunset. Must-see in Busan.',
    'Easy to reach and totally worth it. Bring your camera!',
  ],
  seafood: [
    'Freshest sashimi with a sunset view. Unbeatable.',
    'Raw fish heaven 🐟 Ask for the set — great value.',
  ],
  culture: ['Learned so much about Korean culture here. Kids loved it too.'],
  stay: ['Comfy stay, super close to everything. Would book again.'],
  shopping: ['Grabbed so many souvenirs here 🛍 Tax-free was easy.'],
  village: ['Colorful alleys everywhere — a photographer’s dream.'],
  beach: ['Clean sand, calm waves 🏖 Great spot to relax after walking.'],
}
const DEFAULT_CAPTIONS = [
  'Loved this place! Adding it to every Busan list I share.',
  'Such a friendly vibe — highly recommend to fellow travelers.',
  'One of my favorite stops in Korea so far 🇰🇷',
]

// 문자열 해시(결정론적) — 같은 POI는 항상 같은 작성자·캡션·시간을 갖도록
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

// 두 좌표 거리(km) — Haversine
function distKm(lat0: number, lng0: number, lat: number, lng: number): number {
  const R = 6371
  const dLat = ((lat - lat0) * Math.PI) / 180
  const dLng = ((lng - lng0) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat0 * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// POI + 이미지 풀 → 미디어 배열(대표 이미지 + 추가 이미지 1~2장 + 일부 영상)
function buildMedia(p: Poi, imagePool: string[]): MediaItem[] {
  const items: MediaItem[] = []
  if (p.imageUrl) items.push({ type: 'image', uri: p.imageUrl })
  const extra = (hash(p.id + 'm1') % 2) + 1 // 1~2장 추가
  for (let i = 0; i < extra && imagePool.length; i++) {
    const img = imagePool[hash(p.id + 'x' + i) % imagePool.length]
    if (img && !items.some((m) => m.uri === img)) items.push({ type: 'image', uri: img })
  }
  // 일부 포스트(약 1/3)에 영상 추가 — poster는 대표 이미지
  if (hash(p.id + 'v') % 3 === 0) {
    const v = SAMPLE_VIDEOS[hash(p.id) % SAMPLE_VIDEOS.length]
    items.push({ type: 'video', uri: v, poster: p.imageUrl ?? undefined })
  }
  return items
}

// POI 하나 → 여행자 포스트(결정론적)
function toPost(
  p: Poi,
  coords: { latitude: number; longitude: number },
  imagePool: string[],
): TravelerPost {
  const h = hash(p.id)
  const author = pick(AUTHORS, h)
  const caps = CAPTIONS[p.cat] ?? DEFAULT_CAPTIONS
  const text = pick(caps, hash(p.id + 'c'))
  const ageMin = hash(p.id + 't') % (60 * 72) // 0~72시간 이내
  const dist =
    p.lat != null && p.lng != null
      ? distKm(coords.latitude, coords.longitude, p.lat, p.lng)
      : Infinity
  return {
    id: p.id,
    author: author.name,
    flag: author.flag,
    text,
    media: buildMedia(p, imagePool),
    place: p.name,
    cat: p.cat,
    lat: p.lat,
    lng: p.lng,
    ageMin,
    dist,
    likes: (hash(p.id + 'l') % 240) + 6,
    seedComments: hash(p.id + 'm') % 28,
  }
}

// 시간+거리 복합 정렬 점수(낮을수록 상위) — 최신(6h 단위)과 근접(2km 단위)을 비슷한 가중으로 혼합
function rankScore(post: TravelerPost): number {
  const recency = post.ageMin / 60 / 6 // 6시간을 1점
  const proximity = (post.dist === Infinity ? 30 : post.dist) / 2 // 2km를 1점
  return recency + proximity
}

// 피드 생성 — POI를 포스트화 후 시간+거리 순 정렬.
// 이미지 없는 POI(mock 등)는 PostCard에서 PlaceThumb 그라데이션으로 폴백하므로 필터하지 않는다.
export function buildTravelerFeed(
  pois: Poi[],
  coords: { latitude: number; longitude: number },
): TravelerPost[] {
  const imagePool = pois.map((p) => p.imageUrl).filter((u): u is string => !!u)
  return pois.map((p) => toPost(p, coords, imagePool)).sort((a, b) => rankScore(a) - rankScore(b))
}

// 무한 스크롤 페이지 — count개를 반환. 원본이 부족하면 순환 복제(더 오래된 것으로 이어붙여
// 시간 정렬을 깨지 않음)해 "계속 아래로" 볼 수 있게 한다.
export function feedPage(base: TravelerPost[], count: number): TravelerPost[] {
  if (base.length === 0) return []
  if (count <= base.length) return base.slice(0, count)
  const out = base.slice()
  let page = 1
  while (out.length < count) {
    for (const p of base) {
      if (out.length >= count) break
      out.push({ ...p, id: `${p.id}#${page}`, ageMin: p.ageMin + page * 4320 }) // +3일/페이지
    }
    page++
  }
  return out
}

// 경과 시간 라벨(언어 무관 숫자 표기) — "just now" 만 i18n로 처리
export function ageLabel(ageMin: number, justNow: string): string {
  if (ageMin < 1) return justNow
  if (ageMin < 60) return `${Math.floor(ageMin)}m`
  if (ageMin < 60 * 24) return `${Math.floor(ageMin / 60)}h`
  return `${Math.floor(ageMin / 60 / 24)}d`
}
