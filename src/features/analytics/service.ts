// 전환 퍼널 계측 (PRD REQ-CP-4·REQ-AI-3) — MMKV 큐 적재 후 배치 플러시.
// 오프라인·미인증이면 큐에 보존했다가 다음 track/flush 때 재전송 (이벤트 유실 방지).
// user_id 는 DB 기본값(current_user_id())로 채워지므로 클라이언트는 보내지 않는다.
import { supabase } from '@/lib/supabase'
import { storage } from '@/lib/mmkv'

// 이벤트 사전 — 추가 시 docs/PRODUCT_REQUIREMENTS.md REQ-CP-4·AI-3 의 퍼널 정의와 함께 갱신
export type AnalyticsEventName =
  | 'coupon_list_view' // 쿠폰 목록 노출 {seg, filter, count, is_mock}
  | 'coupon_tap' // 쿠폰 카드 탭(저장 의도) {coupon_id, name, cat, is_mock}
  | 'coupon_qr_issued' // QR 발급 성공 {coupon_id, issue_id, offline, reissue}
  | 'ticket_outlink' // 티켓 아웃링크 이동 {ticket_id, category}
  | 'ai_ask' // AI 깐부 질문 {mode: text|quick|voice, length}
  | 'ai_reply' // AI 응답 수신 {provider: claude|mock, has_card}

export type EventProps = Record<string, string | number | boolean | null>

type QueuedEvent = {
  event: string
  props: EventProps
  client_ts: string
}

const QUEUE_KEY = 'analytics:queue'
const MAX_QUEUE = 500 // 초과 시 오래된 것부터 폐기 (저장 폭주 방지)
const BATCH_SIZE = 20

function loadQueue(): QueuedEvent[] {
  try {
    const raw = storage.getString(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as QueuedEvent[]) : []
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedEvent[]) {
  storage.set(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)))
}

let flushing = false

// 큐를 배치 단위로 서버에 전송. 실패한 배치부터는 큐에 남긴다(다음 기회에 재시도).
// 주의: 전송(await) 중 track()이 큐 뒤에 새 이벤트를 붙일 수 있으므로,
// 전송 성공 후 반드시 큐를 다시 읽어 보낸 만큼만 앞에서 제거한다
// (스냅샷으로 덮어쓰면 전송 중 쌓인 이벤트가 유실됨 — ai_ask/ai_reply 동시 발생 사례).
export async function flush(): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    while (true) {
      const queue = loadQueue()
      if (!queue.length) break
      const batch = queue.slice(0, BATCH_SIZE)
      const { error } = await supabase.from('analytics_events').insert(batch)
      if (error) break
      saveQueue(loadQueue().slice(batch.length))
    }
  } finally {
    flushing = false
  }
}

// 이벤트 기록 — 동기로 큐 적재 후 전송은 fire-and-forget (UI 블로킹 없음)
export function track(event: AnalyticsEventName, props: EventProps = {}) {
  const queue = loadQueue()
  queue.push({ event, props, client_ts: new Date().toISOString() })
  saveQueue(queue)
  void flush()
}
