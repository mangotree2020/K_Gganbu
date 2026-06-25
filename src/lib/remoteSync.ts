// 범용 원격 동기화 큐 — 실패/오프라인 시 MMKV 큐에 보관, 나중에 멱등 재시도.
// 각 행은 client_id(클라이언트 생성) + upsert(onConflict ignore)로 중복 없이 업로드된다.
// 대상 테이블은 client_id text unique 컬럼과 user_id 기본값 current_user_id() RLS를 가진다.
import { supabase } from '@/lib/supabase'
import { storage } from '@/lib/mmkv'

const QUEUE_KEY = 'remoteSyncQueue'
const MAX_QUEUE = 100

type Pending = {
  client_id: string
  table: string
  sig: string // 로컬 중복 적재 방지용 서명(업로드에는 미포함)
  row: Record<string, unknown>
  at: number
}

function read(): Pending[] {
  try {
    const raw = storage.getString(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as Pending[]) : []
  } catch {
    return []
  }
}
function write(q: Pending[]) {
  try {
    storage.set(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)))
  } catch {
    // 무시
  }
}

// 업로드 대기열 적재 — 같은 (table, sig)는 중복 적재하지 않음.
export function enqueueSync(table: string, sig: string, row: Record<string, unknown>) {
  const q = read()
  if (q.some((p) => p.table === table && p.sig === sig)) return
  const client_id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  q.push({ client_id, table, sig, row, at: Date.now() })
  write(q)
}

async function tryUpsert(table: string, client_id: string, row: Record<string, unknown>) {
  try {
    const { error } = await supabase
      .from(table)
      .upsert({ client_id, ...row }, { onConflict: 'client_id', ignoreDuplicates: true })
    return !error
  } catch {
    return false
  }
}

// 대기열 전송 — 성공분 제거, 실패분 유지(다음 기회에 재시도). 동시 실행 방지.
let flushing = false
export async function flushSync(): Promise<void> {
  if (flushing) return
  const q = read()
  if (!q.length) return
  flushing = true
  try {
    const remaining: Pending[] = []
    for (const p of q) {
      const ok = await tryUpsert(p.table, p.client_id, p.row)
      if (!ok) remaining.push(p)
    }
    write(remaining)
  } finally {
    flushing = false
  }
}
