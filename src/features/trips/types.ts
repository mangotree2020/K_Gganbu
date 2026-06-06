import { z } from 'zod'

export const tripSchema = z.object({
  title: z.string().min(1, '여행 제목을 입력해주세요'),
  destination: z.string().min(1, '여행지를 입력해주세요'),
  startDate: z.string().min(1, '시작일을 선택해주세요'),
  endDate: z.string().min(1, '종료일을 선택해주세요'),
  coverImageUrl: z.string().url().optional(),
  description: z.string().optional(),
})

export type TripFormData = z.infer<typeof tripSchema>

export interface Trip extends TripFormData {
  id: string
  userId: string
  createdAt: string
  updatedAt?: string
}

export interface ItineraryItem {
  id: string
  tripId: string
  date: string
  order: number
  title: string
  description: string | null
  location: string | null
  startTime: string | null
  endTime: string | null
}
