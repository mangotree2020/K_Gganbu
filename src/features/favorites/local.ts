// 즐겨찾기 로컬 저장소 + 서버 동기화 큐.
// 저장 버튼은 네트워크를 기다리지 않는다: MMKV에 즉시 쓰고(=UI 반영), 서버 반영은 이 모듈이
// 뒤에서 처리한다. 실패분은 큐에 남아 다음 조회/토글/세션 확보 때 재시도되므로 오프라인 저장도 유지된다.
import { useAuthStore } from '@/features/auth/store'
import { storage } from '@/lib/mmkv'
import { supabase } from '@/lib/supabase'
import { collapseQueue, pruneExpired, removeSentOps } from './ops'
import type { FavOp, FavoriteRow } from './types'

// 저장 키는 계정(auth uid)별로 분리한다. 값 안에 소유자를 두면 계정을 바꿀 때 이전 계정의
// 목록·미전송 큐를 물리적으로 덮어써 버린다(로그아웃 후 복귀 시 유실).
// Guest→로그인 승격은 auth.uid가 유지되므로 그대로 승계된다.
const LIST_KEY = 'favorites.list'
const QUEUE_KEY = 'favorites.queue'
const UID_KEY = 'favorites.uid' // public.users.id — 토글마다의 조회 왕복 제거용
const MAX_QUEUE = 200

export function currentAuthId(): string | null {
  return useAuthStore.getState().user?.id ?? null
}

function read<T>(key: string, fallback: T, authId = currentAuthId()): T {
  if (!authId) return fallback
  try {
    const raw = storage.getString(`${key}:${authId}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T, authId = currentAuthId()) {
  if (!authId) return
  try {
    storage.set(`${key}:${authId}`, JSON.stringify(value))
  } catch {
    // 저장 실패는 무시 — 서버가 최종 진실이고 다음 조회에서 복구된다
  }
}

export function readLocalFavorites(): FavoriteRow[] {
  return read<FavoriteRow[]>(LIST_KEY, [])
}

export function writeLocalFavorites(rows: FavoriteRow[]) {
  write(LIST_KEY, rows)
}

export function readQueue(authId = currentAuthId()): FavOp[] {
  return read<FavOp[]>(QUEUE_KEY, [], authId)
}

function writeQueue(queue: FavOp[], authId = currentAuthId()) {
  write(QUEUE_KEY, queue.slice(-MAX_QUEUE), authId)
}

// 작업 id 순번 — 같은 밀리초에 재토글해도 전송 완료분을 정확히 지목하기 위한 단조 증가값
let opSeq = 0

export function enqueueFavOp(op: Omit<FavOp, 'id'>) {
  opSeq += 1
  writeQueue(collapseQueue(readQueue(), { ...op, id: `${op.at}-${opSeq}` }))
}

// public.users.id 해석 — 토글마다 select 왕복이 들리던 부분. auth.uid 기준으로 캐시한다.
let uidCache: { authId: string; userId: string } | null = null

async function resolveUserId(authId: string): Promise<string | null> {
  if (uidCache?.authId === authId) return uidCache.userId

  const cached = read<{ userId: string } | null>(UID_KEY, null, authId)
  if (cached?.userId) {
    uidCache = { authId, userId: cached.userId }
    return cached.userId
  }

  const { data, error } = await supabase.from('users').select('id').single()
  const userId = (data?.id as string | undefined) ?? null
  if (error || !userId) return null
  // 조회 중 계정이 바뀌었으면 캐시하지 않는다(다른 계정 id를 물고 있게 됨)
  if (currentAuthId() !== authId) return null
  uidCache = { authId, userId }
  write(UID_KEY, { userId }, authId)
  return userId
}

// 단일 작업 서버 반영 — 존재 확인 select 없이 1왕복(unique(user_id, place_ext_id, type) 활용).
// ignoreDuplicates: favorites에는 UPDATE RLS 정책이 없어 ON CONFLICT DO UPDATE가 거부된다.
// 즐겨찾기는 존재 여부만 의미가 있으므로 DO NOTHING으로 충분하다.
async function pushOp(userId: string, op: FavOp): Promise<boolean> {
  try {
    if (op.op === 'remove') {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('place_ext_id', op.poi.extId)
        .eq('type', 'place')
      return !error
    }
    const { error } = await supabase.from('favorites').upsert(
      {
        user_id: userId,
        place_ext_id: op.poi.extId,
        name: op.poi.name,
        address: op.poi.address ?? null,
        lat: op.poi.lat ?? null,
        lng: op.poi.lng ?? null,
        image_url: op.poi.imageUrl ?? null,
        cat: op.poi.cat ?? null,
        type: 'place',
      },
      { onConflict: 'user_id,place_ext_id,type', ignoreDuplicates: true },
    )
    return !error
  } catch {
    return false // 네트워크 예외 → 큐에 남겨 재시도
  }
}

// 큐 1회 배출. 처리 중 계정이 바뀌면 즉시 중단한다(다른 계정 큐를 건드리지 않도록).
async function drain(authId: string): Promise<void> {
  const userId = await resolveUserId(authId)
  if (!userId || currentAuthId() !== authId) return

  const pruned = pruneExpired(readQueue(authId), Date.now())
  if (pruned.length !== readQueue(authId).length) writeQueue(pruned, authId)

  const sent: FavOp[] = []
  for (const op of pruned) {
    if (currentAuthId() !== authId) break
    if (await pushOp(userId, op)) sent.push(op)
  }
  if (sent.length && currentAuthId() === authId) {
    writeQueue(removeSentOps(readQueue(authId), sent), authId)
  }
}

// 대기열 전송. 동시 실행은 막되, 전송 중 들어온 새 작업은 끝난 뒤 이어서 배출한다
// (여기서 그냥 반환하면 최신 의도가 다음 조회 때까지 서버에 반영되지 않는다).
let flushing = false
let rerun = false

export async function flushFavorites(): Promise<void> {
  if (flushing) {
    rerun = true
    return
  }
  const authId = currentAuthId()
  if (!authId || !readQueue(authId).length) return
  flushing = true
  try {
    do {
      rerun = false
      await drain(authId)
    } while (rerun && currentAuthId() === authId && readQueue(authId).length)
  } finally {
    flushing = false
  }
}
