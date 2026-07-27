// 실 후기 → 피드 포스트 변환 (REQ-UGC-2)
// 합성 포스트와 같은 모델로 맞춰야 한 목록에 섞이므로, 필드 계약이 깨지면 피드가 조용히 어긋난다.
import { realReviewToPost } from './feed'

const base = {
  id: 'r1',
  author: 'Yuki',
  place: 'Halmae Gukbap',
  cat: 'food',
  rating: 5,
  text: 'Great!',
  createdAt: new Date(Date.now() - 30 * 60_000).toISOString(), // 30분 전
}

describe('realReviewToPost', () => {
  it('합성 포스트와 충돌하지 않도록 id에 접두사를 붙인다', () => {
    expect(realReviewToPost(base).id).toBe('rv:r1')
  })

  it('작성 경과를 분 단위로 환산한다', () => {
    expect(realReviewToPost(base).ageMin).toBeGreaterThanOrEqual(29)
    expect(realReviewToPost(base).ageMin).toBeLessThanOrEqual(31)
  })

  it('본문이 없으면 별점을 본문으로 대신한다 (빈 카드 방지)', () => {
    expect(realReviewToPost({ ...base, text: '', rating: 4 }).text).toBe('★★★★')
  })

  it('사진이 있으면 이미지 미디어로, 없으면 빈 배열(카테고리 썸네일 폴백)', () => {
    expect(realReviewToPost({ ...base, photos: ['https://x/a.jpg'] }).media).toEqual([
      { type: 'image', uri: 'https://x/a.jpg' },
    ])
    expect(realReviewToPost(base).media).toEqual([])
  })

  it('국적 정보를 저장하지 않으므로 중립 아이콘을 쓴다', () => {
    expect(realReviewToPost(base).flag).toBe('🧳')
  })

  it('좌표가 없어 거리 정렬에서 뒤로 밀린다', () => {
    const p = realReviewToPost(base)
    expect(p.lat).toBeNull()
    expect(p.lng).toBeNull()
    expect(p.dist).toBe(Infinity)
  })
})
