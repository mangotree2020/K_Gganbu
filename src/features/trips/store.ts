import { create } from 'zustand'

type TripFilter = 'upcoming' | 'past' | 'all'

interface TripsState {
  selectedTripId: string | null
  filter: TripFilter
  setSelectedTrip: (id: string | null) => void
  setFilter: (filter: TripFilter) => void
}

export const useTripsStore = create<TripsState>((set) => ({
  selectedTripId: null,
  filter: 'upcoming',
  setSelectedTrip: (id) => set({ selectedTripId: id }),
  setFilter: (filter) => set({ filter }),
}))
