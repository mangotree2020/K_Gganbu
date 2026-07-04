// 장소 ↔ 딜(쿠폰·티켓) 매칭 — LBS 근접성 우선(BM §5 S-7, REQ-CP).
// 1순위: 딜의 매장 좌표(파트너 등록 시 주소 지오코딩, partners.lat/lng)와 장소 좌표의
//        거리 ≤ DEAL_NEAR_M이면 같은 장소로 판정 — 가장 가까운 딜 선택.
// 2순위: 좌표가 없는 딜(지오코딩 실패분)만 이름 토큰 겹침 폴백.
// 홈 추천 카드·지도 장소 시트·AI 추천 카드가 공용으로 사용한다.

export const DEAL_NEAR_M = 150 // 동일 부지 판정 반경(m) — 몰 내 점포·부속 시설 오차 흡수

export type DealPoint = { name: string; lat?: number | null; lng?: number | null }

// 두 좌표 간 거리(m) — Haversine
function distM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

const normTokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)

export function matchDeal<T extends DealPoint>(poi: DealPoint, deals: T[]): T | null {
  // 1) 좌표 근접 — 반경 내 최근접 딜
  const poiHasCoords = poi.lat != null && poi.lng != null
  if (poiHasCoords) {
    let best: T | null = null
    let bestM = DEAL_NEAR_M
    for (const d of deals) {
      if (d.lat == null || d.lng == null) continue
      const m = distM(poi.lat!, poi.lng!, d.lat, d.lng)
      if (m <= bestM) {
        best = d
        bestM = m
      }
    }
    if (best) return best
  }
  // 2) 이름 토큰 폴백 — 장소에 좌표가 있으면 좌표 보유 딜은 이미 근접 판정이 끝났으므로 제외,
  //    장소에 좌표가 없으면(AI 카드 등 이름만 있는 행) 모든 딜을 이름으로 판정
  const pt = normTokens(poi.name)
  if (!pt.length) return null
  for (const c of deals) {
    if (poiHasCoords && c.lat != null && c.lng != null) continue
    const ct = normTokens(c.name)
    if (!ct.length) continue
    const overlap = ct.filter((w) => pt.some((p) => p.includes(w) || w.includes(p))).length
    // 딜명 토큰 2개 이상 겹치거나, 단일 토큰 딜명이 그대로 포함되면 동일 장소로 판정
    if (overlap >= 2 || (overlap >= 1 && ct.length === 1)) return c
  }
  return null
}
