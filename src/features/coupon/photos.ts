// 쿠폰·딜 실사진 썸네일 — place-lookup(photoName)으로 장소 대표 사진 확보.
// MMKV 캐시 키(dealphoto:{name})는 홈 오늘의 딜과 공유 — 중복 호출 없음.
import { useEffect, useState } from 'react'
import { storage } from '@/lib/mmkv'
import { supabase } from '@/lib/supabase'

export function useCouponPhotos(names: string[]) {
  const [photos, setPhotos] = useState<Record<string, string | null>>({})
  const key = names.join('|')

  useEffect(() => {
    let alive = true
    ;(async () => {
      for (const name of names) {
        if (!name) continue
        const ck = `dealphoto:${name}`
        const cached = storage.getString(ck)
        if (cached !== undefined && cached !== null) {
          if (alive)
            setPhotos((m) =>
              m[name] !== undefined ? m : { ...m, [name]: cached === '' ? null : cached },
            )
          continue
        }
        try {
          const { data } = await supabase.functions.invoke('place-lookup', {
            body: { photoName: `${name} Busan` },
          })
          const url: string | null = data?.url ?? null
          storage.set(ck, url ?? '')
          if (alive) setPhotos((m) => ({ ...m, [name]: url }))
        } catch {
          if (alive) setPhotos((m) => ({ ...m, [name]: null }))
        }
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return photos
}
