// 댓글 목록 조립 — 서버/로컬 합치기·중복 제거·정렬
import {
  countRows,
  mergeComments,
  pruneSyncedLocal,
  type LocalComment,
  type RemoteComment,
} from './comments'

const NOW = Date.parse('2026-08-06T12:00:00.000Z')
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString()

const remote = (
  id: string,
  author: string,
  body: string,
  min: number,
  parentId: string | null = null,
): RemoteComment => ({ id, author, body, parentId, createdAt: minsAgo(min) })

const local = (id: string, text: string, min: number): LocalComment => ({
  id,
  text,
  ts: NOW - min * 60000,
})

describe('mergeComments', () => {
  it('서버 댓글을 원댓글 + 대댓글 1단계로 묶는다', () => {
    const rows = mergeComments(
      [remote('a', 'Mina', '좋아요', 30), remote('b', 'Ken', '동감', 10, 'a')],
      [],
      'Me',
      NOW,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.replies.map((r) => r.body)).toEqual(['동감'])
  })

  it('로컬 댓글(게스트)도 같은 모델로 합쳐 시간순 정렬한다 — 오래된 것부터', () => {
    const rows = mergeComments(
      [remote('a', 'Mina', '먼저', 60)],
      [local('l1', '나중', 5)],
      'Me',
      NOW,
    )
    expect(rows.map((r) => r.body)).toEqual(['먼저', '나중'])
  })

  // 이 화면의 원래 결함: 같은 댓글이 실명(서버)과 "나"(로컬)로 두 번 보였다
  it('서버·로컬을 각각 한 줄로만 그린다(합치기 자체는 중복을 만들지 않는다)', () => {
    const rows = mergeComments([remote('a', 'Me', '씻고', 5)], [], 'Me', NOW)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.mine).toBe(true)
  })

  it('내 표시 이름과 다르면 남의 댓글로 본다', () => {
    const rows = mergeComments([remote('a', 'Mina', 'hi', 1)], [], 'Me', NOW)
    expect(rows[0]!.mine).toBe(false)
  })

  it('경과 시간(분)을 계산한다 — 미래 시각은 0으로 막는다', () => {
    const rows = mergeComments([remote('a', 'Mina', 'hi', -10)], [], 'Me', NOW)
    expect(rows[0]!.ageMin).toBe(0)
  })

  it('로컬 답글은 부모 아래에 유지된다', () => {
    const withReply: LocalComment = {
      ...local('l1', '원댓글', 20),
      replies: [local('l1:r1', '내 답글', 5)],
    }
    const rows = mergeComments([], [withReply], 'Me', NOW)
    expect(rows[0]!.replies.map((r) => r.body)).toEqual(['내 답글'])
  })

  it('게스트가 서버 댓글에 남긴 답글은 상대 이름을 보존한다', () => {
    const rows = mergeComments(
      [],
      [{ ...local('l1', '고마워요', 1), replyToName: 'Mina' }],
      'Me',
      NOW,
    )
    expect(rows[0]!.replyToName).toBe('Mina')
  })

  it('둘 다 비면 빈 배열', () => {
    expect(mergeComments([], [], 'Me', NOW)).toEqual([])
  })
})

describe('countRows', () => {
  it('원댓글과 대댓글을 모두 센다', () => {
    const rows = mergeComments(
      [remote('a', 'Mina', 'x', 5), remote('b', 'Ken', 'y', 3, 'a'), remote('c', 'Ann', 'z', 1)],
      [],
      'Me',
      NOW,
    )
    expect(countRows(rows)).toBe(3)
  })

  it('빈 목록은 0', () => {
    expect(countRows([])).toBe(0)
  })
})

describe('pruneSyncedLocal', () => {
  const synced = (body: string, min: number) => ({ body, ts: NOW - min * 60000 })

  it('서버에 올라간 본문과 같은 로컬 복사본을 지운다', () => {
    const out = pruneSyncedLocal(
      [local('l1', '씻고', 1), local('l2', '먹는거', 1)],
      [synced('씻고', 1)],
    )
    expect(out.map((c) => c.text)).toEqual(['먹는거'])
  })

  // 같은 말을 두 번 쓴 사용자의 댓글을 통째로 날리지 않는다
  it('같은 본문이 여러 개면 서버에 있는 개수만큼만 지운다', () => {
    const out = pruneSyncedLocal(
      [local('l1', 'ㅋㅋ', 2), local('l2', 'ㅋㅋ', 1)],
      [synced('ㅋㅋ', 1)],
    )
    expect(out).toHaveLength(1)
  })

  // 표시 이름은 계정 식별자가 아니다 — 동명이인이 같은 말을 남겨도 내 기록이 지워지면 안 된다
  it('작성 시각이 멀면(같은 submit이 아니면) 지우지 않는다', () => {
    const list = [local('l1', '좋아요', 1)]
    expect(pruneSyncedLocal(list, [synced('좋아요', 600)])).toBe(list)
  })

  it('답글이 달린 로컬 댓글은 지우지 않는다(답글까지 함께 사라지므로)', () => {
    const parent: LocalComment = {
      ...local('l1', '씻고', 1),
      replies: [local('l1:r1', '나도', 0)],
    }
    expect(pruneSyncedLocal([parent], [synced('씻고', 1)])).toHaveLength(1)
  })

  it('일치하는 본문이 없으면 원본을 그대로 돌려준다', () => {
    const list = [local('l1', '씻고', 1)]
    expect(pruneSyncedLocal(list, [synced('다른말', 1)])).toBe(list)
  })

  it('빈 입력은 원본 유지', () => {
    const list = [local('l1', '씻고', 1)]
    expect(pruneSyncedLocal(list, [])).toBe(list)
    expect(pruneSyncedLocal([], [synced('씻고', 1)])).toEqual([])
  })
})

describe('mergeComments — 고아 답글', () => {
  // 서버 조회는 최근 100건이라 부모가 범위 밖일 수 있다. 그때 답글이 통째로 사라지면 안 된다.
  it('부모가 목록에 없는 답글은 원댓글 자리에 올려 보존한다', () => {
    const rows = mergeComments([remote('b', 'Ken', '답글만', 5, 'missing-parent')], [], 'Me', NOW)
    expect(rows.map((r) => r.body)).toEqual(['답글만'])
  })
})
