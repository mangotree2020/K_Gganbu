// 즐겨찾기 순수 로직 — MMKV·네트워크 의존 없음(단위 테스트 대상).
// 저장 반응 속도를 위해 "로컬이 먼저, 서버는 나중"이므로 아래 두 가지를 순수 함수로 분리한다.
//  ① 로컬 목록 토글(즉시 UI 반영)  ② 서버 응답 위에 미전송 작업을 재적용(순서 역전 방지)
import type { FavOp, FavoriteRow, FavPoi } from './types'

// 서버 발급 uuid와 구분되는 로컬 임시 행 id (서버 동기화 후 실제 id로 교체됨)
export const LOCAL_ROW_PREFIX = 'local:'

export function localRowId(extId: string): string {
  return `${LOCAL_ROW_PREFIX}${extId}`
}

// POI → 로컬 임시 행. 서버 insert 결과를 기다리지 않고 목록/아이콘을 채우기 위한 것.
export function makeLocalRow(poi: FavPoi, at: number): FavoriteRow {
  return {
    id: localRowId(poi.extId),
    place_ext_id: poi.extId,
    name: poi.name,
    address: poi.address ?? null,
    lat: poi.lat ?? null,
    lng: poi.lng ?? null,
    image_url: poi.imageUrl ?? null,
    cat: poi.cat ?? null,
    created_at: new Date(at).toISOString(),
  }
}

// 로컬 목록 토글 — 있으면 제거, 없으면 최신순 맨 앞에 추가
export function toggleRows(
  rows: FavoriteRow[],
  poi: FavPoi,
  at: number,
): { rows: FavoriteRow[]; added: boolean } {
  const exists = rows.some((r) => r.place_ext_id === poi.extId)
  if (exists) {
    return { rows: rows.filter((r) => r.place_ext_id !== poi.extId), added: false }
  }
  return { rows: [makeLocalRow(poi, at), ...rows], added: true }
}

// 대기열 적재 — 같은 장소의 이전 작업은 버린다(마지막 의도만 유효: add→remove면 서버 작업 0회)
export function collapseQueue(queue: FavOp[], op: FavOp): FavOp[] {
  return [...queue.filter((q) => q.poi.extId !== op.poi.extId), op]
}

// 전송 성공분 제거 — 전송 도중 같은 장소를 다시 토글했으면(id 불일치) 새 작업을 남긴다.
// (같은 밀리초 재토글로 at이 겹칠 수 있어 순번이 포함된 id로 대조한다)
export function removeSentOps(queue: FavOp[], sent: FavOp[]): FavOp[] {
  const sentIds = new Set(sent.map((s) => s.id))
  return queue.filter((q) => !sentIds.has(q.id))
}

// 오래된 미전송 작업 폐기 — 계정 삭제·RLS 거부처럼 영구 실패하는 작업이 무한 재시도되며
// 로컬 상태를 서버와 영구히 어긋나게 두는 것보다, 폐기 후 서버 기준으로 자가 복구하는 편이 낫다.
export const OP_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function pruneExpired(queue: FavOp[], now: number, ttlMs = OP_TTL_MS): FavOp[] {
  return queue.filter((q) => now - q.at < ttlMs)
}

// 서버 응답 위에 미전송 작업 재적용 — 방금 저장한 항목이 조회 결과에 없다고 사라지면 안 된다
export function applyOps(rows: FavoriteRow[], queue: FavOp[]): FavoriteRow[] {
  if (!queue.length) return rows
  let next = rows
  for (const q of queue) {
    next =
      q.op === 'remove'
        ? next.filter((r) => r.place_ext_id !== q.poi.extId)
        : next.some((r) => r.place_ext_id === q.poi.extId)
          ? next
          : [makeLocalRow(q.poi, q.at), ...next]
  }
  return next
}

// place_ext_id 기준 중복 제거 — 서버 행 우선(로컬 임시 행보다 id·created_at이 정확)
export function dedupeRows(rows: FavoriteRow[]): FavoriteRow[] {
  const seen = new Map<string, FavoriteRow>()
  for (const r of rows) {
    const prev = seen.get(r.place_ext_id)
    if (!prev) {
      seen.set(r.place_ext_id, r)
      continue
    }
    if (prev.id.startsWith(LOCAL_ROW_PREFIX) && !r.id.startsWith(LOCAL_ROW_PREFIX)) {
      seen.set(r.place_ext_id, r)
    }
  }
  return [...seen.values()]
}
