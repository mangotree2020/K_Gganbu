import { z } from 'zod'

export const profileSchema = z.object({
  fullName: z.string().min(2, '이름은 2자 이상이어야 합니다'),
  avatarUrl: z.string().url().optional(),
})

export type ProfileFormData = z.infer<typeof profileSchema>

export interface Profile {
  id: string
  fullName: string | null
  avatarUrl: string | null
  createdAt: string
}
