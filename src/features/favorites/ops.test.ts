// 즐겨찾기 로컬 우선 저장 로직 — 낙관적 토글·대기열 병합·서버 응답 재적용
import {
  applyOps,
  collapseQueue,
  dedupeRows,
  localRowId,
  makeLocalRow,
  OP_TTL_MS,
  pruneExpired,
  removeSentOps,
  toggleRows,
} from './ops'
import type { FavOp, FavoriteRow, FavPoi } from './types'

const poi = (extId: string, name = extId): FavPoi => ({ extId, name })
const op = (o: 'add' | 'remove', extId: string, at: number): FavOp => ({
  id: `${at}-${extId}`,
  op: o,
  poi: poi(extId),
  at,
})
const serverRow = (extId: string, name = extId): FavoriteRow => ({
  id: `uuid-${extId}`,
  place_ext_id: extId,
  name,
  address: null,
  lat: null,
  lng: null,
  image_url: null,
  cat: null,
  created_at: '2026-08-01T00:00:00.000Z',
})

describe('makeLocalRow', () => {
  it('POI의 선택 필드 누락을 null로 정규화한다', () => {
    const row = makeLocalRow({ extId: 'a', name: 'A' }, 0)
    expect(row).toMatchObject({
      id: localRowId('a'),
      place_ext_id: 'a',
      name: 'A',
      address: null,
      lat: null,
      lng: null,
      image_url: null,
      cat: null,
      created_at: '1970-01-01T00:00:00.000Z',
    })
  })

  it('좌표 0을 null로 떨어뜨리지 않는다(적도·본초자오선 경계값)', () => {
    const row = makeLocalRow({ extId: 'a', name: 'A', lat: 0, lng: 0 }, 0)
    expect(row.lat).toBe(0)
    expect(row.lng).toBe(0)
  })
})

describe('toggleRows', () => {
  it('없으면 맨 앞에 추가한다(최신순)', () => {
    const { rows, added } = toggleRows([serverRow('a')], poi('b'), 1000)
    expect(added).toBe(true)
    expect(rows.map((r) => r.place_ext_id)).toEqual(['b', 'a'])
  })

  it('있으면 제거한다', () => {
    const { rows, added } = toggleRows([serverRow('a'), serverRow('b')], poi('a'), 1000)
    expect(added).toBe(false)
    expect(rows.map((r) => r.place_ext_id)).toEqual(['b'])
  })

  it('빈 목록에서도 동작한다', () => {
    expect(toggleRows([], poi('a'), 0).rows).toHaveLength(1)
  })

  it('원본 배열을 변경하지 않는다(낙관적 롤백용 스냅샷 보존)', () => {
    const before = [serverRow('a')]
    toggleRows(before, poi('b'), 0)
    expect(before.map((r) => r.place_ext_id)).toEqual(['a'])
  })
})

describe('collapseQueue', () => {
  it('같은 장소의 이전 작업을 마지막 의도로 대체한다', () => {
    const add: FavOp = op('add', 'a', 1)
    const remove: FavOp = op('remove', 'a', 2)
    expect(collapseQueue(collapseQueue([], add), remove)).toEqual([remove])
  })

  it('다른 장소 작업은 유지한다', () => {
    const a: FavOp = op('add', 'a', 1)
    const b: FavOp = op('add', 'b', 2)
    expect(collapseQueue([a], b)).toEqual([a, b])
  })
})

describe('removeSentOps', () => {
  const sent: FavOp = op('add', 'a', 1)

  it('전송 성공분을 제거한다', () => {
    expect(removeSentOps([sent], [sent])).toEqual([])
  })

  it('전송 중 다시 토글된 작업(id 불일치)은 남긴다', () => {
    const requeued: FavOp = op('remove', 'a', 9)
    expect(removeSentOps([requeued], [sent])).toEqual([requeued])
  })

  // 같은 밀리초에 add→remove로 재토글되면 at은 같다. id로 대조하지 않으면 최신 remove까지
  // 전송 완료로 오인해 지워져, 서버는 추가·로컬은 삭제 상태로 영구히 어긋난다.
  it('같은 밀리초에 재토글된 작업은 at이 같아도 남긴다', () => {
    const requeued: FavOp = { id: 'other', op: 'remove', poi: poi('a'), at: sent.at }
    expect(removeSentOps([requeued], [sent])).toEqual([requeued])
  })

  it('전송하지 않은 다른 장소 작업은 남긴다', () => {
    const other: FavOp = op('add', 'b', 2)
    expect(removeSentOps([other], [sent])).toEqual([other])
  })
})

describe('pruneExpired', () => {
  it('TTL이 지난 작업만 버린다', () => {
    const old: FavOp = op('add', 'a', 0)
    const fresh: FavOp = op('add', 'b', OP_TTL_MS)
    expect(pruneExpired([old, fresh], OP_TTL_MS + 1)).toEqual([fresh])
  })

  it('TTL 경계값(정확히 TTL 경과)은 버린다', () => {
    expect(pruneExpired([op('add', 'a', 0)], OP_TTL_MS)).toEqual([])
  })
})

describe('applyOps', () => {
  it('대기열이 비면 서버 응답을 그대로 쓴다', () => {
    const rows = [serverRow('a')]
    expect(applyOps(rows, [])).toBe(rows)
  })

  it('미전송 추가는 서버 응답에 없어도 유지한다', () => {
    const result = applyOps([serverRow('a')], [op('add', 'b', 1)])
    expect(result.map((r) => r.place_ext_id)).toEqual(['b', 'a'])
  })

  it('미전송 삭제는 서버 응답에 남아 있어도 지운다', () => {
    const result = applyOps([serverRow('a')], [op('remove', 'a', 1)])
    expect(result).toEqual([])
  })

  it('서버에 이미 반영된 추가는 중복 생성하지 않는다', () => {
    const result = applyOps([serverRow('a')], [op('add', 'a', 1)])
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('uuid-a')
  })
})

describe('dedupeRows', () => {
  it('같은 장소가 겹치면 서버 행을 남긴다', () => {
    const result = dedupeRows([makeLocalRow(poi('a'), 0), serverRow('a')])
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('uuid-a')
  })

  it('중복이 없으면 순서를 보존한다', () => {
    expect(dedupeRows([serverRow('a'), serverRow('b')]).map((r) => r.place_ext_id)).toEqual([
      'a',
      'b',
    ])
  })
})
