// Admin 게이트 공용 헬퍼 — 다음 둘 중 하나면 관리자 인가:
//  1) x-admin-key 헤더 === ADMIN_API_KEY (기존 공유 시크릿, 백업 수단)
//  2) Authorization JWT의 사용자 이메일이 ADMIN_EMAILS(쉼표 구분) 허용 목록에 포함
//     (Admin 웹의 Google 로그인 경로 — 키 입력 없이 SNS 로그인만으로 사용)
import { createClient } from 'jsr:@supabase/supabase-js@2'

export async function isAdmin(req: Request): Promise<boolean> {
  const adminKey = Deno.env.get('ADMIN_API_KEY')
  if (adminKey && req.headers.get('x-admin-key') === adminKey) return true

  const allow = (Deno.env.get('ADMIN_EMAILS') ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (!allow.length) return false

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return false
  const email = (data.user.email ?? '').toLowerCase()
  return allow.includes(email)
}
