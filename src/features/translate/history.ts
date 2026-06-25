// 음성 통역 대화 이력 — MMKV(로컬) + Supabase(원격, 사용자별) 저장/조회.
// 텍스트만 보관(음성 PCM 제외). 원격은 RLS로 본인 데이터만, 게스트→로그인 시 동일 user_id 승계.
import { supabase } from '@/lib/supabase'
import { storage } from '@/lib/mmkv'

const KEY = 'voiceHistory'
const MAX_SESSIONS = 20

export type HistoryTurn = { original: string; translation: string; lang: string }
export type VoiceSession = { id: number; at: number; lang: string; turns: HistoryTurn[] }

// 세션 동일성 판별용 서명 — 로컬·원격 중복 제거(같은 세션이 양쪽에 저장됨)
export function sessionSignature(s: VoiceSession): string {
  const first = s.turns[0]
  return `${s.turns.length}|${first?.original ?? ''}|${first?.translation ?? ''}`
}

// 세션 저장 — 빈 대화는 저장하지 않음. 최근 MAX_SESSIONS개만 유지.
export function saveSession(turns: HistoryTurn[], lang: string) {
  if (!turns.length) return
  try {
    const at = Date.now()
    const raw = storage.getString(KEY)
    const arr: VoiceSession[] = raw ? JSON.parse(raw) : []
    arr.push({ id: at, at, lang, turns })
    storage.set(KEY, JSON.stringify(arr.slice(-MAX_SESSIONS)))
  } catch {
    // 저장 실패 무시(이력은 부가 기능)
  }
}

// 최신순 세션 목록
export function loadSessions(): VoiceSession[] {
  try {
    const raw = storage.getString(KEY)
    const arr: VoiceSession[] = raw ? JSON.parse(raw) : []
    return arr.slice().reverse()
  } catch {
    return []
  }
}

export function clearSessions() {
  storage.set(KEY, '[]')
}

// ── 원격(Supabase) — 사용자별 보관 ───────────────────────────────────────────

// 원격 세션 저장 — user_id는 DB 기본값 current_user_id()로 자동. 실패는 무시(로컬 보존).
export async function saveSessionRemote(turns: HistoryTurn[], myLang: string, peerLang: string) {
  if (!turns.length) return
  try {
    await supabase
      .from('voice_sessions')
      .insert({ my_lang: myLang, peer_lang: peerLang, turns, turn_count: turns.length })
  } catch {
    // 네트워크/권한 실패 무시 — 로컬 이력은 별도로 보존됨
  }
}

// 원격 세션 목록(최신순) — 로그인/게스트 모두 본인 데이터만(RLS)
export async function loadRemoteSessions(): Promise<VoiceSession[]> {
  try {
    const { data, error } = await supabase
      .from('voice_sessions')
      .select('my_lang, turns, created_at')
      .order('created_at', { ascending: false })
      .limit(MAX_SESSIONS)
    if (error || !data) return []
    return data.map((r) => {
      const at = new Date(r.created_at as string).getTime()
      return {
        id: at,
        at,
        lang: (r.my_lang as string) ?? 'en',
        turns: ((r.turns as HistoryTurn[]) ?? []) as HistoryTurn[],
      }
    })
  } catch {
    return []
  }
}

// 원격 본인 세션 전체 삭제(이력 비우기)
export async function clearRemoteSessions() {
  try {
    await supabase.from('voice_sessions').delete().not('id', 'is', null)
  } catch {
    // 무시
  }
}

// 로컬+원격 병합(서명 기준 중복 제거, 최신순)
export function mergeSessions(local: VoiceSession[], remote: VoiceSession[]): VoiceSession[] {
  const seen = new Set<string>()
  const out: VoiceSession[] = []
  for (const s of [...remote, ...local]) {
    const sig = sessionSignature(s)
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push(s)
  }
  return out.sort((a, b) => b.at - a.at)
}
