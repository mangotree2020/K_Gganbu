import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
})

export const registerSchema = loginSchema
  .extend({
    fullName: z.string().min(2, '이름은 2자 이상이어야 합니다'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['confirmPassword'],
  })

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>

export interface AuthUser {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  createdAt: string
}
