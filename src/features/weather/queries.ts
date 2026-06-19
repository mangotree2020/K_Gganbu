// 실시간 날씨 — Open-Meteo(무료·API 키 불필요·CORS 허용). 현재 좌표의 기온/날씨/바람 +
// 해안이면 파고(marine API). 실패 시 mock 폴백(mock-first 원칙).
import { useQuery } from '@tanstack/react-query'

import type { Coords } from '@/hooks/useCurrentLocation'

export type WeatherCondition = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'

export type Weather = {
  tempC: number
  condition: WeatherCondition
  windKph: number
  humidity: number | null
  waveM: number | null // 해안만(육지/실패 시 null)
  isMock: boolean
}

// WMO weather_code → 앱 컨디션 (Open-Meteo 표준)
function toCondition(code: number): WeatherCondition {
  if (code === 0) return 'clear'
  if (code <= 2) return 'partly' // 1,2 = 대체로 맑음/부분 흐림
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 85 && code <= 86) return 'snow'
  if (code >= 95) return 'storm'
  if (code >= 51 && code <= 82) return 'rain' // 이슬비·비·소나기
  return 'cloudy'
}

// 컨디션 → Icon 이름
export const conditionIcon: Record<WeatherCondition, string> = {
  clear: 'weather_clear',
  partly: 'weather_partly',
  cloudy: 'weather_cloudy',
  fog: 'weather_fog',
  rain: 'weather_rain',
  snow: 'weather_snow',
  storm: 'weather_storm',
}

// 컨디션 → i18n 키
export const conditionLabelKey: Record<WeatherCondition, string> = {
  clear: 'weather.clear',
  partly: 'weather.partly',
  cloudy: 'weather.cloudy',
  fog: 'weather.fog',
  rain: 'weather.rain',
  snow: 'weather.snow',
  storm: 'weather.storm',
}

const MOCK: Weather = {
  tempC: 19,
  condition: 'clear',
  windKph: 8,
  humidity: 60,
  waveM: 0.6,
  isMock: true,
}

export function useWeather(coords: Coords) {
  return useQuery({
    queryKey: ['weather', coords.latitude.toFixed(2), coords.longitude.toFixed(2)],
    staleTime: 1000 * 60 * 10, // 10분
    queryFn: async (): Promise<Weather> => {
      try {
        const { latitude: lat, longitude: lng } = coords
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
          `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m`
        const res = await fetch(url)
        if (!res.ok) throw new Error('weather')
        const cur = (await res.json())?.current
        if (!cur || typeof cur.temperature_2m !== 'number') throw new Error('shape')

        // 파고는 해안에서만 유효 — 실패/육지는 조용히 null
        let waveM: number | null = null
        try {
          const m = await fetch(
            `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=wave_height`,
          )
          if (m.ok) {
            const v = (await m.json())?.current?.wave_height
            if (typeof v === 'number') waveM = Math.round(v * 10) / 10
          }
        } catch {
          // 파고 미지원 위치 — 무시
        }

        return {
          tempC: Math.round(cur.temperature_2m),
          condition: toCondition(Number(cur.weather_code)),
          windKph: Math.round(cur.wind_speed_10m ?? 0),
          humidity: typeof cur.relative_humidity_2m === 'number' ? cur.relative_humidity_2m : null,
          waveM,
          isMock: false,
        }
      } catch {
        return MOCK
      }
    },
  })
}
