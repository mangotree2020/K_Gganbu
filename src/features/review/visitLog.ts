// 방문 기록 순수 로직 — MMKV·네트워크 의존 없음(단위 테스트 대상).
// "다녀온 곳에만 후기를 요청한다"가 원칙이다. 아무 장소나 별점을 물으면 후기 신뢰도가 떨어지고
// 사용자에게도 성가시다. 방문 근거는 셋 중 하나다: 길찾기 도착, 쿠폰 사용, 티켓 구매.

export type VisitSource = 'arrival' | 'coupon' | 'ticket'

export type Visit = {
  placeKey: string // 장소 식별자(외부 POI id 또는 'g:<googlePlaceId>')
  name: string
  cat: string
  lat: number | null
  lng: number | null
  at: number // 방문 시각(ms)
  source: VisitSource
  reviewed: boolean
  // 쿠폰 발급 id — 후기를 어느 경로에서 쓰든 서버의 "사용 1건당 1후기" 제약이 걸리도록
  // 방문 기록에 함께 보존한다. 이게 없으면 대기 목록 경로가 제약을 우회한다.
  refId?: string | null
}

// 후기 요청 유효 기간 — 너무 오래된 방문은 기억이 흐려져 후기 품질이 떨어지고,
// 뒤늦게 뜨는 알림은 성가심으로 남는다.
export const VISIT_TTL_MS = 7 * 24 * 60 * 60 * 1000
// 보관 개수 상한(로컬 저장소 보호)
export const MAX_VISITS = 50
// 도착 판정 반경 — GPS 오차(도심 10~30m)와 건물 규모를 감안한 값
export const ARRIVAL_RADIUS_M = 120

// 두 좌표 간 거리(m) — Haversine
export function distanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

// 목적지 도착 판정
export function isArrived(
  here: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  radiusM = ARRIVAL_RADIUS_M,
): boolean {
  return distanceM(here, dest) <= radiusM
}

// 방문 적재 — 같은 장소는 최신 방문으로 갱신한다(같은 곳을 두 번 물어보지 않도록).
// 이미 후기를 남긴 장소를 다시 방문하면 후기를 다시 받을 수 있게 reviewed를 푼다.
export function addVisit(list: Visit[], v: Omit<Visit, 'reviewed'>): Visit[] {
  const prev = list.find((x) => x.placeKey === v.placeKey)
  // 같은 방문(동일 장소·같은 TTL 창)이 반복 보고돼도 후기 상태는 유지한다 —
  // 도착 판정은 GPS 갱신마다 참이라 여기서 reviewed를 풀면 후기 요청이 계속 되살아난다.
  const reviewed = prev ? prev.reviewed && v.at - prev.at < VISIT_TTL_MS : false
  return [{ ...v, reviewed }, ...list.filter((x) => x.placeKey !== v.placeKey)].slice(0, MAX_VISITS)
}

// 후기 작성 완료 표시
export function markReviewed(list: Visit[], placeKey: string): Visit[] {
  return list.map((v) => (v.placeKey === placeKey ? { ...v, reviewed: true } : v))
}

// 후기 요청 대상 — 최근 방문 + 아직 후기 없음(최신순)
export function pendingVisits(list: Visit[], now: number, ttlMs = VISIT_TTL_MS): Visit[] {
  return list.filter((v) => !v.reviewed && now - v.at < ttlMs)
}

// 아직 후기를 안 남긴 최근 방문인지 — 후기 작성 진입점 노출 조건.
// (남긴 뒤에도 버튼이 남아 있으면 refId 없는 경로에서 중복 후기가 계속 쌓인다)
export function needsReview(list: Visit[], placeKey: string, now: number, ttlMs = VISIT_TTL_MS) {
  const v = list.find((x) => x.placeKey === placeKey)
  return !!v && !v.reviewed && now - v.at < ttlMs
}

// 만료 기록 정리
export function pruneVisits(list: Visit[], now: number, ttlMs = VISIT_TTL_MS): Visit[] {
  return list.filter((v) => now - v.at < ttlMs)
}
