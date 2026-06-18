// 음성 통역 대화 이력 — MMKV에 최근 세션 저장/조회. 텍스트만 보관(음성 PCM 제외).
import { storage } from '@/lib/mmkv'

const KEY = 'voiceHistory'
const MAX_SESSIONS = 20

export type HistoryTurn = { original: string; translation: string; lang: string }
export type VoiceSession = { id: number; at: number; lang: string; turns: HistoryTurn[] }

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
