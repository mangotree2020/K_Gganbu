// 방문 기록 로직 — 도착 판정·중복 방문·후기 대상 선별
import {
  addVisit,
  ARRIVAL_RADIUS_M,
  distanceM,
  isArrived,
  markReviewed,
  MAX_VISITS,
  needsReview,
  pendingVisits,
  pruneVisits,
  VISIT_TTL_MS,
  type Visit,
} from './visitLog'

const HAEUNDAE = { lat: 35.1587, lng: 129.1604 }
const visit = (placeKey: string, at: number, reviewed = false): Visit => ({
  placeKey,
  name: placeKey,
  cat: 'sights',
  lat: null,
  lng: null,
  at,
  source: 'arrival',
  reviewed,
})

describe('distanceM', () => {
  it('같은 좌표는 0', () => {
    expect(distanceM(HAEUNDAE, HAEUNDAE)).toBe(0)
  })

  it('위도 0.001도 차이는 약 111m', () => {
    const d = distanceM(HAEUNDAE, { lat: HAEUNDAE.lat + 0.001, lng: HAEUNDAE.lng })
    expect(d).toBeGreaterThan(105)
    expect(d).toBeLessThan(115)
  })
})

describe('isArrived', () => {
  it('반경 안이면 도착', () => {
    expect(isArrived(HAEUNDAE, { lat: HAEUNDAE.lat + 0.0005, lng: HAEUNDAE.lng })).toBe(true)
  })

  it('반경 밖이면 미도착', () => {
    expect(isArrived(HAEUNDAE, { lat: HAEUNDAE.lat + 0.01, lng: HAEUNDAE.lng })).toBe(false)
  })

  it('경계값(정확히 반경)은 도착으로 본다', () => {
    // 반경과 같은 거리를 만들 수 없어 반경 자체를 넉넉히 준 경우로 대체
    expect(isArrived(HAEUNDAE, HAEUNDAE, 0)).toBe(true)
    expect(
      isArrived(HAEUNDAE, { lat: HAEUNDAE.lat + 0.002, lng: HAEUNDAE.lng }, ARRIVAL_RADIUS_M),
    ).toBe(false)
  })
})

describe('addVisit', () => {
  const base = {
    placeKey: 'p1',
    name: 'P1',
    cat: 'cafe',
    lat: null,
    lng: null,
    source: 'arrival' as const,
  }

  it('새 방문은 맨 앞에 쌓인다', () => {
    const list = addVisit([visit('p0', 1)], { ...base, at: 2 })
    expect(list.map((v) => v.placeKey)).toEqual(['p1', 'p0'])
  })

  it('같은 장소 재방문은 중복 없이 최신으로 갱신된다', () => {
    const list = addVisit(addVisit([], { ...base, at: 1 }), { ...base, at: 5 })
    expect(list).toHaveLength(1)
    expect(list[0]!.at).toBe(5)
  })

  // 도착 판정은 GPS 갱신마다 참이므로, 여기서 reviewed를 풀면 후기 요청이 계속 되살아난다
  it('후기를 남긴 직후 같은 위치가 다시 보고돼도 후기 요청을 되살리지 않는다', () => {
    const reviewed = markReviewed(addVisit([], { ...base, at: 1 }), 'p1')
    const again = addVisit(reviewed, { ...base, at: 1 + 4000 })
    expect(again[0]!.reviewed).toBe(true)
  })

  it('TTL이 지난 뒤 재방문하면 후기를 다시 받는다', () => {
    const reviewed = markReviewed(addVisit([], { ...base, at: 1 }), 'p1')
    const again = addVisit(reviewed, { ...base, at: 1 + VISIT_TTL_MS })
    expect(again[0]!.reviewed).toBe(false)
  })

  it('보관 개수 상한을 넘지 않는다', () => {
    let list: Visit[] = []
    for (let i = 0; i < MAX_VISITS + 10; i++) {
      list = addVisit(list, { ...base, placeKey: `p${i}`, at: i })
    }
    expect(list).toHaveLength(MAX_VISITS)
    expect(list[0]!.placeKey).toBe(`p${MAX_VISITS + 9}`) // 최신이 앞
  })
})

describe('pendingVisits', () => {
  it('후기 없는 최근 방문만 고른다', () => {
    const list = [visit('a', 100), visit('b', 100, true), visit('c', 100 - VISIT_TTL_MS)]
    expect(pendingVisits(list, 100).map((v) => v.placeKey)).toEqual(['a'])
  })

  it('전부 후기 완료면 빈 배열', () => {
    expect(pendingVisits([visit('a', 1, true)], 2)).toEqual([])
  })
})

describe('needsReview', () => {
  it('후기 없는 최근 방문이면 true', () => {
    expect(needsReview([visit('a', 100)], 'a', 200)).toBe(true)
  })

  // refId 없는 경로(도착·장소·티켓)는 서버 중복 제약이 없어 진입점을 닫는 것이 유일한 방어다
  it('후기를 남겼으면 false — 진입점을 닫아 중복 작성을 막는다', () => {
    expect(needsReview([visit('a', 100, true)], 'a', 200)).toBe(false)
  })

  it('TTL이 지났으면 false', () => {
    expect(needsReview([visit('a', 0)], 'a', VISIT_TTL_MS)).toBe(false)
  })
})

describe('refId 보존', () => {
  // 쿠폰 발급 id가 유실되면 후기 대기 목록 경로가 서버의 "사용 1건당 1후기"를 우회한다
  it('재방문 갱신에도 쿠폰 발급 id가 유지된다', () => {
    const base = {
      placeKey: 'coupon:1',
      name: 'Store',
      cat: 'market',
      lat: null,
      lng: null,
      source: 'coupon' as const,
      refId: 'issue-1',
    }
    const list = addVisit(addVisit([], { ...base, at: 1 }), { ...base, at: 2 })
    expect(list[0]!.refId).toBe('issue-1')
  })
})

describe('pruneVisits', () => {
  it('TTL이 지난 기록을 버린다', () => {
    const list = [visit('a', 0), visit('b', VISIT_TTL_MS)]
    expect(pruneVisits(list, VISIT_TTL_MS + 1).map((v) => v.placeKey)).toEqual(['b'])
  })
})
