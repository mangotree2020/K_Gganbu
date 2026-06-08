import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Destination } from './types'

const PAGE_SIZE = 20

export function useDestinations(search?: string) {
  return useInfiniteQuery({
    queryKey: ['destinations', search],
    queryFn: async ({ pageParam = 0 }) => {
      const { data } = await api.get<Destination[]>('/destinations', {
        params: { page: pageParam, limit: PAGE_SIZE, search },
      })
      return data
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
    initialPageParam: 0,
  })
}
