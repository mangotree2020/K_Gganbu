import type { User } from '@supabase/supabase-js'
import type { AuthUser } from './types'

// Supabase User → 앱 AuthUser 매핑
export function toAuthUser(user: User): AuthUser {
  const meta = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email ?? null,
    fullName: (meta.full_name as string) ?? (meta.name as string) ?? null,
    avatarUrl: (meta.avatar_url as string) ?? null,
    createdAt: user.created_at,
    isGuest: user.is_anonymous ?? false,
  }
}
