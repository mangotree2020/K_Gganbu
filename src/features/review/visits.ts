// 방문 기록 저장소 — MMKV 로컬. 후기 요청 자격("정말 다녀왔는가")의 근거를 들고 있는다.
// 서버 테이블을 새로 만들지 않는 이유: 후기 자체는 이미 서버에 저장되고(reviews),
// 방문 근거는 "이 기기에서 도착·사용을 관측했다"는 로컬 사실이면 충분하다.
// 판정 로직은 visitLog.ts(순수 함수, 단위 테스트)에 있다.
import { useAuthStore } from '@/features/auth/store'
import { storage } from '@/lib/mmkv'
import {
  addVisit,
  markReviewed,
  needsReview,
  pendingVisits,
  pruneVisits,
  type Visit,
  type VisitSource,
} from './visitLog'

// 계정별 저장 — 로그아웃 후 다른 계정으로 들어왔을 때 이전 사용자의 동선(방문 기록)이
// 보이거나, 그 방문에 남의 후기가 달리면 안 된다. Guest 승격은 auth.uid가 유지돼 승계된다.
const KEY = 'review.visits'

function scopedKey(): string | null {
  const authId = useAuthStore.getState().user?.id
  return authId ? `${KEY}:${authId}` : null
}

export function readVisits(): Visit[] {
  const key = scopedKey()
  if (!key) return []
  try {
    const raw = storage.getString(key)
    return raw ? (JSON.parse(raw) as Visit[]) : []
  } catch {
    return []
  }
}

function write(list: Visit[]) {
  const key = scopedKey()
  if (!key) return
  try {
    storage.set(key, JSON.stringify(list))
  } catch {
    // 저장 실패는 무시 — 후기 요청이 한 번 안 뜰 뿐, 다른 기능에 영향 없음
  }
}

// 방문 기록 — 길찾기 도착·쿠폰 사용·티켓 구매 시 호출
export function recordVisit(v: {
  placeKey: string
  name: string
  cat?: string | null
  lat?: number | null
  lng?: number | null
  source: VisitSource
  refId?: string | null
}) {
  const now = Date.now()
  write(
    addVisit(pruneVisits(readVisits(), now), {
      placeKey: v.placeKey,
      name: v.name,
      cat: v.cat ?? 'sights',
      lat: v.lat ?? null,
      lng: v.lng ?? null,
      at: now,
      source: v.source,
      refId: v.refId ?? null,
    }),
  )
}

// 후기 작성 완료 — 같은 곳을 다시 묻지 않는다
export function markVisitReviewed(placeKey: string) {
  write(markReviewed(readVisits(), placeKey))
}

// 후기를 기다리는 방문(최신순)
export function readPendingVisits(): Visit[] {
  return pendingVisits(readVisits(), Date.now())
}

// 후기 진입점 노출 조건 — 최근 방문 + 아직 후기 없음
export function needsReviewFor(placeKey: string): boolean {
  return needsReview(readVisits(), placeKey, Date.now())
}

// 방문 기록에 보존된 쿠폰 발급 id(있으면 서버 중복 제약이 걸린다)
export function refIdForVisit(placeKey: string): string | null {
  return readVisits().find((v) => v.placeKey === placeKey)?.refId ?? null
}

export type { Visit, VisitSource } from './visitLog'
