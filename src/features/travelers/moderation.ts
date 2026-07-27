// 신고·차단 서버 기록 (PRD REQ-UGC-3)
// 화면 반영은 로컬 store 가 즉시 처리하고, 여기서는 서버에 남겨 기기 간 동기화·운영 대응을 가능하게 한다.
// 로그인 전(게스트)에는 서버 기록을 건너뛴다 — 차단은 로컬만으로도 사용자 목적을 달성한다.
import { supabase } from '@/lib/supabase'

export type ReportReason = 'spam' | 'offensive' | 'sexual' | 'violence' | 'other'

async function myId(): Promise<string | null> {
  const { data } = await supabase.rpc('current_user_id')
  return (data as string | null) ?? null
}

export async function reportContent(input: {
  targetType: 'post' | 'comment' | 'user'
  targetId: string
  reason: ReportReason
  note?: string
}): Promise<void> {
  const me = await myId()
  if (!me) return
  await supabase.from('content_reports').insert({
    reporter_id: me,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    note: input.note ?? null,
  })
}

export async function blockAuthorRemote(authorKey: string): Promise<void> {
  const me = await myId()
  if (!me) return
  await supabase
    .from('blocked_authors')
    .upsert({ user_id: me, author_key: authorKey }, { onConflict: 'user_id,author_key' })
}
