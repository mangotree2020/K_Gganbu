export interface Destination {
  id: string
  name: string
  country: string
  region: string | null
  description: string | null
  coverImageUrl: string | null
  tags: string[] | null
  rating: number | null
  latitude: number | null
  longitude: number | null
}
