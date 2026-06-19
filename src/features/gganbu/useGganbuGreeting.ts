// AI 깐부 홈 인사 — 앱 시작 시 시간대 greeting을 먼저 보여주고(greeting 스타일),
// 이후 장소·시간·날씨 맞춤 메시지를 30초마다 순환. 메시지가 바뀔 때마다 앱 언어로 읽어준다(TTS).
// 홈이 포커스된 동안에만 순환·발화(다른 탭에서 말하지 않도록).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useIsFocused } from 'expo-router'

import { speakMessage, stopSpeak } from '@/lib/speak'
import type { WeatherCondition } from '@/features/weather/queries'
import { buildGganbuGreetings, gganbuGreeting } from './greetings'

const ROTATE_MS = 30000 // 30초마다 다음 메시지

type Args = {
  lang: string
  city: string
  condition: WeatherCondition | undefined
  hour: number
}

export type GreetingItem = { text: string; isGreeting: boolean }

export function useGganbuGreeting({ lang, city, condition, hour }: Args): GreetingItem {
  // [0]=시간대 인사(greeting 스타일), [1..]=컨텍스트 메시지
  const items = useMemo<GreetingItem[]>(() => {
    const greeting: GreetingItem = { text: gganbuGreeting(lang, hour), isGreeting: true }
    const context = buildGganbuGreetings(lang, hour, condition, city).map((t) => ({
      text: t,
      isGreeting: false,
    }))
    return [greeting, ...context]
  }, [lang, hour, condition, city])

  const [idx, setIdx] = useState(0)
  const focused = useIsFocused()
  const spokenRef = useRef(-1)

  // 30초 순환 (포커스 중에만). 모듈로로 풀 크기 변화 흡수 → idx 리셋 불필요.
  useEffect(() => {
    if (!focused || items.length < 2) return
    const id = setInterval(() => setIdx((i) => i + 1), ROTATE_MS)
    return () => clearInterval(id)
  }, [items, focused])

  const cur = items[idx % items.length] ?? items[0]

  // 메시지 변경(및 홈 진입) 시 앱 언어로 발화 — 같은 idx 재발화 방지
  useEffect(() => {
    if (!focused || spokenRef.current === idx) return
    spokenRef.current = idx
    speakMessage(cur.text, lang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, focused])

  // 홈을 벗어나면 발화 중단
  useEffect(() => {
    if (!focused) stopSpeak()
  }, [focused])

  return cur
}
