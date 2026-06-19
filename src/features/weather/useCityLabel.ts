// 좌표 → 도시 라벨을 "앱 선택 언어"로. BigDataCloud reverse-geocode(무료·키 불필요·언어 지원)
// 우선, 실패 시 expo-location(기기 로케일)로 폴백. 예) en="U-dong, Busan", ja="宇洞, 釜山広域市".
import { useEffect, useState } from 'react'
import * as Location from 'expo-location'

import type { Coords } from '@/hooks/useCurrentLocation'

// 앱 언어 → BigDataCloud localityLanguage (ISO 639-1). 중문 간/번체는 zh로 통합.
const LOCALITY_LANG: Record<string, string> = {
  en: 'en',
  ko: 'ko',
  ja: 'ja',
  'zh-CN': 'zh',
  'zh-TW': 'zh',
}

function joinParts(local: string | null, city: string | null): string | null {
  const parts = [local, city]
    .filter((v): v is string => !!v)
    .filter((v, i, arr) => arr.indexOf(v) === i) // 중복 제거
  return parts.slice(0, 2).join(', ') || city || local
}

export function useCityLabel(coords: Coords, lang: string) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const { latitude, longitude } = coords
    const ll = LOCALITY_LANG[lang] ?? 'en'
    ;(async () => {
      // 1) BigDataCloud — 앱 언어 지명
      try {
        const r = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=${ll}`,
        )
        if (r.ok) {
          const d = await r.json()
          const out = joinParts(d.locality || null, d.city || d.principalSubdivision || null)
          if (alive && out) {
            setLabel(out)
            return
          }
        }
      } catch {
        // 폴백으로 진행
      }
      // 2) 폴백 — 기기 로케일 역지오코딩
      try {
        const a = (await Location.reverseGeocodeAsync(coords))[0]
        if (alive && a) {
          setLabel(
            joinParts(a.district || a.subregion || a.name || null, a.city || a.region || null),
          )
        }
      } catch {
        // 폴백 실패 — 호출측 기본 라벨 사용
      }
    })()
    return () => {
      alive = false
    }
    // 좌표·앱 언어 변화 시 재조회(언어 바뀌면 지명도 재현지화)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords.latitude, coords.longitude, lang])

  return label
}
