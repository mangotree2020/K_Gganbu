// 장소 ↔ 딜 매칭 (REQ-CP-5) — 홈 추천·지도 시트·AI 카드가 공유하는 판정이라
// 여기서 틀리면 "엉뚱한 가게 쿠폰"이 붙는다(북극성 지표 동선의 신뢰 문제).
import { matchDeal, DEAL_NEAR_M } from './matchDeal'

const HAEUNDAE = { lat: 35.1587, lng: 129.1604 }
// 약 100m 북쪽 (위도 1도 ≈ 111km)
const NEAR = { lat: HAEUNDAE.lat + 0.0009, lng: HAEUNDAE.lng }
// 약 1km 북쪽 — 반경 밖
const FAR = { lat: HAEUNDAE.lat + 0.009, lng: HAEUNDAE.lng }

describe('matchDeal — 좌표 근접 우선', () => {
  it('반경 내 딜을 매칭한다', () => {
    const deals = [{ name: 'Bada View Cafe', ...NEAR }]
    expect(matchDeal({ name: 'Haeundae Beach', ...HAEUNDAE }, deals)?.name).toBe('Bada View Cafe')
  })

  it('반경 밖 딜은 매칭하지 않는다 (이름도 다를 때)', () => {
    const deals = [{ name: 'Somewhere Else', ...FAR }]
    expect(matchDeal({ name: 'Haeundae Beach', ...HAEUNDAE }, deals)).toBeNull()
  })

  it('반경 내 후보가 여럿이면 가장 가까운 것을 고른다', () => {
    const deals = [
      { name: 'Farther', lat: HAEUNDAE.lat + 0.001, lng: HAEUNDAE.lng },
      { name: 'Closer', lat: HAEUNDAE.lat + 0.0002, lng: HAEUNDAE.lng },
    ]
    expect(matchDeal({ name: 'Haeundae Beach', ...HAEUNDAE }, deals)?.name).toBe('Closer')
  })

  it('반경 상수는 몰 내 점포 오차를 흡수할 정도(150m)', () => {
    expect(DEAL_NEAR_M).toBe(150)
  })
})

describe('matchDeal — 이름 토큰 폴백', () => {
  it('좌표 없는 장소는 이름으로 매칭한다 (토큰 2개 이상 겹침)', () => {
    const deals = [{ name: 'Halmae Gukbap' }]
    expect(matchDeal({ name: 'Halmae Gukbap Busan' }, deals)?.name).toBe('Halmae Gukbap')
  })

  it('단일 토큰 딜명은 포함만 돼도 매칭한다', () => {
    const deals = [{ name: 'Jagalchi' }]
    expect(matchDeal({ name: 'Jagalchi Market' }, deals)?.name).toBe('Jagalchi')
  })

  it('무관한 이름은 매칭하지 않는다', () => {
    const deals = [{ name: 'Glow K-Beauty' }]
    expect(matchDeal({ name: 'Gamcheon Culture Village' }, deals)).toBeNull()
  })

  it('장소에 좌표가 있으면 좌표 보유 딜은 이름 폴백에서 제외한다 (먼 동명 매장 오매칭 방지)', () => {
    const deals = [{ name: 'Halmae Gukbap', ...FAR }] // 이름은 같지만 1km 밖
    expect(matchDeal({ name: 'Halmae Gukbap', ...HAEUNDAE }, deals)).toBeNull()
  })

  it('짧은 토큰(2글자 이하)만 있는 이름은 매칭하지 않는다', () => {
    expect(matchDeal({ name: 'AB' }, [{ name: 'AB' }])).toBeNull()
  })
})
