import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/features/auth/store'
import type { Profile, ProfileFormData } from './types'

export function useProfile() {
  const userId = useAuthStore((state) => state.user?.id)

  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await api.get<Profile>('/profile')
      return data
    },
    enabled: !!userId,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)

  return useMutation({
    mutationFn: async (formData: ProfileFormData) => {
      const { data } = await api.put<Profile>('/profile', formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
    },
  })
}
