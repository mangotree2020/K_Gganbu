import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/features/auth/store'
import type { Trip, TripFormData } from './types'

const TRIPS_KEY = ['trips'] as const

export function useTrips() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: [...TRIPS_KEY, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', userId!)
        .order('start_date', { ascending: true })

      if (error) throw error
      return data as Trip[]
    },
    enabled: !!userId,
  })
}

export function useCreateTrip() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)

  return useMutation({
    mutationFn: async (formData: TripFormData) => {
      const { data, error } = await supabase
        .from('trips')
        .insert({ ...formData, user_id: userId })
        .select()
        .single()

      if (error) throw error
      return data as Trip
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
      const { error } = await supabase.from('trips').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIPS_KEY })
    },
  })
}
