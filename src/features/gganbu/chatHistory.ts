// AI 깐부 대화 이력 — MMKV에 세션 저장/조회. 텍스트(역할·내용)만 보관.
import { storage } from '@/lib/mmkv'

const KEY = 'gganbuChatHistory'
const MAX_SESSIONS = 30

export type ChatHistMsg = { role: 'bot' | 'user'; text: string }
export type ChatSession = { id: number; at: number; title: string; messages: ChatHistMsg[] }

function readAll(): ChatSession[] {
  try {
    const raw = storage.getString(KEY)
    return raw ? (JSON.parse(raw) as ChatSession[]) : []
  } catch {
    return []
  }
}

// 세션 저장/갱신(upsert) — id가 있으면 갱신, 없으면 신규. 사용자 발화가 1개 이상일 때만.
// 반환: 세션 id(이후 같은 대화 갱신에 사용).
export function saveChatSession(messages: ChatHistMsg[], id?: number): number {
  const userMsgs = messages.filter((m) => m.role === 'user' && m.text.trim())
  if (!userMsgs.length) return id ?? 0
  try {
    const arr = readAll()
    const sid = id && id > 0 ? id : Date.now()
    const slim = messages.filter((m) => m.text.trim()).map((m) => ({ role: m.role, text: m.text }))
    const session: ChatSession = {
      id: sid,
      at: Date.now(),
      title: userMsgs[0].text.trim().slice(0, 40),
      messages: slim,
    }
    const idx = arr.findIndex((s) => s.id === sid)
    if (idx >= 0) arr[idx] = session
    else arr.push(session)
    storage.set(KEY, JSON.stringify(arr.slice(-MAX_SESSIONS)))
    return sid
  } catch {
    return id ?? 0
  }
}

// 최신순 세션 목록
export function loadChatSessions(): ChatSession[] {
  return readAll().slice().reverse()
}

export function deleteChatSession(id: number) {
  try {
    storage.set(KEY, JSON.stringify(readAll().filter((s) => s.id !== id)))
  } catch {
    // 무시
  }
}

export function clearChatSessions() {
  storage.set(KEY, '[]')
}
