// 댓글 목록 조립 순수 로직 — MMKV·네트워크 의존 없음(단위 테스트 대상).
// 댓글은 두 곳에 있을 수 있다: 서버(feed_comments, 로그인 사용자·타인)와 로컬(게스트).
// 저장처가 둘이라 화면에서 합칠 때 같은 댓글이 두 번 보이기 쉬웠다 — 그 규칙을 여기 모은다.

export type RemoteComment = {
  id: string
  author: string
  parentId: string | null
  body: string
  createdAt: string
}

export type LocalComment = {
  id: string
  text: string
  ts: number
  replies?: LocalComment[]
  replyToName?: string
}

// 화면에 그릴 한 줄 — 서버·로컬 출처를 여기서 하나의 모델로 통일한다
export type CommentRow = {
  id: string
  author: string
  mine: boolean
  body: string
  ageMin: number
  replyToName?: string
  replies: CommentRow[]
}

const minsSince = (ms: number, now: number) => Math.max(0, Math.round((now - ms) / 60000))

// 서버 + 로컬 → 시간순 단일 트리(원댓글 + 대댓글 1단계, 오래된 것부터).
// mine 판정은 표시용(아바타·You 배지)이라 표시 이름 비교로 충분하다 —
// 같은 이름을 쓰는 타인은 구분하지 못하지만, 이 값으로 권한을 나누지는 않는다.
export function mergeComments(
  remote: RemoteComment[],
  local: LocalComment[],
  myName: string,
  now: number,
): CommentRow[] {
  const ids = new Set(remote.map((c) => c.id))
  // 부모가 조회 범위(최근 100건) 밖이면 답글이 통째로 사라진다 → 원댓글 자리에 올려 보존한다
  const isRoot = (c: RemoteComment) => !c.parentId || !ids.has(c.parentId)
  const roots: CommentRow[] = remote.filter(isRoot).map((c) => ({
    id: c.id,
    author: c.author,
    mine: c.author === myName,
    body: c.body,
    ageMin: minsSince(new Date(c.createdAt).getTime(), now),
    replies: remote
      .filter((r) => r.parentId === c.id && !isRoot(r))
      .map((r) => ({
        id: r.id,
        author: r.author,
        mine: r.author === myName,
        body: r.body,
        ageMin: minsSince(new Date(r.createdAt).getTime(), now),
        replies: [],
      })),
  }))

  const locals: CommentRow[] = local.map((c) => ({
    id: c.id,
    author: myName,
    mine: true,
    body: c.text,
    ageMin: minsSince(c.ts, now),
    ...(c.replyToName ? { replyToName: c.replyToName } : {}),
    replies: (c.replies ?? []).map((r) => ({
      id: r.id,
      author: myName,
      mine: true,
      body: r.text,
      ageMin: minsSince(r.ts, now),
      replies: [],
    })),
  }))

  return [...roots, ...locals].sort((a, b) => b.ageMin - a.ageMin)
}

// 원댓글 + 대댓글 총 개수(시트 헤더 표시용)
export function countRows(rows: CommentRow[]): number {
  return rows.reduce((n, r) => n + 1 + r.replies.length, 0)
}

// 이중 저장되던 시절의 로컬 복사본 제거(자가 복구).
// 판정은 본문만으로 하지 않는다 — 표시 이름은 계정 식별자가 아니라서, 동명이인이 같은 말을
// 남기면 남의 댓글 때문에 내 기록이 지워질 수 있다. 같은 submit에서 갈라져 나온 쌍은
// 작성 시각이 몇 초 이내로 붙어 있으므로 시간 창을 함께 본다.
export const PRUNE_WINDOW_MS = 5 * 60 * 1000

export function pruneSyncedLocal(
  local: LocalComment[],
  synced: { body: string; ts: number }[],
  windowMs = PRUNE_WINDOW_MS,
): LocalComment[] {
  if (!local.length || !synced.length) return local
  const pool = [...synced]
  const next = local.filter((c) => {
    // 답글이 달린 로컬 댓글은 지우지 않는다 — 부모를 지우면 그 아래 답글까지 함께 사라진다
    if (c.replies?.length) return true
    const i = pool.findIndex((s) => s.body === c.text && Math.abs(s.ts - c.ts) <= windowMs)
    if (i === -1) return true
    pool.splice(i, 1)
    return false
  })
  // 지운 게 없으면 같은 참조를 돌려준다 — 호출측(스토어·렌더)이 헛되이 갱신되지 않도록
  return next.length === local.length ? local : next
}
