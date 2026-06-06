import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Destination } from './types'

const PAGE_SIZE = 20

export function useDestinations(search?: string) {
  return useInfiniteQuery({
    queryKey: ['destinations', search],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('destinations')
        .select('*')
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)

      if (search) {
        query = query.ilike('name', `%${search}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Destination[]
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length : undefined,
    initialPageParam: 0,
  })
}
