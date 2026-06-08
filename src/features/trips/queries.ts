import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/features/auth/store'
import type { Trip, TripFormData } from './types'

const TRIPS_KEY = ['trips'] as const

export function useTrips() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: [...TRIPS_KEY, userId],
    queryFn: async () => {
      const { data } = await api.get<Trip[]>('/trips')
      return data
    },
    enabled: !!userId,
  })
}

export function useCreateTrip() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (formData: TripFormData) => {
      const { data } = await api.post<Trip>('/trips', formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIPS_KEY })
    },
  })
}

export function useDeleteTrip() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/trips/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIPS_KEY })
    },
  })
}
