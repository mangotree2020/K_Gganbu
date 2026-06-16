// 음성 통역 토큰 서비스 — livekit-token Edge Function 호출 (PLANNING §25)
import { supabase } from '@/lib/supabase'

export type LiveKitGrant = {
  token: string
  url: string | null
  room: string
  identity: string
}

// LiveKit 접속 토큰 발급. 키 미설정/오류 시 null → UI에서 폴백 안내.
export async function getVoiceToken(opts: {
  sourceLang?: string
  targetLang: string
}): Promise<LiveKitGrant | null> {
  try {
    const { data, error } = await supabase.functions.invoke('livekit-token', {
      body: { sourceLang: opts.sourceLang ?? 'auto', targetLang: opts.targetLang },
    })
    if (error) throw error
    if (data?.token && data?.url) return data as LiveKitGrant
    return null
  } catch {
    return null
  }
}
