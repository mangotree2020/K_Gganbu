// AI 깐부 홈 인사 — 앱 시작 시 시간대 greeting을 먼저 보여주고(greeting 스타일),
// 이후 장소·시간·날씨 맞춤 메시지를 30초마다 순환. 메시지가 바뀔 때마다 앱 언어로 읽어준다(TTS).
// 홈이 포커스된 동안에만 순환·발화(다른 탭에서 말하지 않도록).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useIsFocused } from 'expo-router'

import { useGganbuLive } from '@/features/gganbu/live'
import { speakMessage, stopSpeak } from '@/lib/speak'
import type { WeatherCondition } from '@/features/weather/queries'
import { buildGganbuGreetings, gganbuGreeting } from './greetings'

const ROTATE_MS = 30000 // 30초마다 다음 메시지

type Args = {
  lang: string
  city: string
  condition: WeatherCondition | undefined
  hour: number
  // 가장 가까운 추천 장소 — 질문 메시지 낭독 뒤 AI 깐부가 이어서 답변(추천)할 때 사용
  nearby?: { name: string; km: number } | null
}

// 질문 뒤에 이어 말하는 깐부의 답변 — 실제 주변 장소 추천(앱 언어)
function answerLine(lang: string, nearby: { name: string; km: number }): string {
  const km = nearby.km < 10 ? nearby.km.toFixed(1) : Math.round(nearby.km).toString()
  switch (lang) {
    case 'ko':
      return `가까운 ${nearby.name} 어때요? ${km}킬로미터면 금방이에요.`
    case 'ja':
      return `近くの${nearby.name}はどうですか？ ${km}キロです。`
    case 'zh-CN':
      return `附近的${nearby.name}怎么样？只有${km}公里。`
    case 'zh-TW':
      return `附近的${nearby.name}怎麼樣？只有${km}公里。`
    default:
      return `How about ${nearby.name} nearby? It's only ${km} kilometers away.`
  }
}

export type GreetingItem = { text: string; isGreeting: boolean }
// muted/toggleMute: 질문·답변 낭독 소리 끄기 — 히어로 우측 하단 스피커 버튼용.
// 설정은 MMKV에 저장되어 앱 재시작 후에도 유지된다.
export type GreetingHandle = GreetingItem & { muted: boolean; toggleMute: () => void }

export function useGganbuGreeting({ lang, city, condition, hour, nearby }: Args): GreetingHandle {
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
  // 깐부 라이브(전역)와 통합 — muted = 깐부 비활성. 끄면 진행 중 발화도 즉시 중단.
  const gganbuActive = useGganbuLive((s) => s.active)
  const toggleLive = useGganbuLive((s) => s.toggle)
  const muted = !gganbuActive
  const toggleMute = () => {
    if (gganbuActive) stopSpeak() // 끄는 순간 발화 중단
    toggleLive()
  }

  // 30초 순환 (포커스 중에만). 모듈로로 풀 크기 변화 흡수 → idx 리셋 불필요.
  useEffect(() => {
    if (!focused || items.length < 2) return
    const id = setInterval(() => setIdx((i) => i + 1), ROTATE_MS)
    return () => clearInterval(id)
  }, [items, focused])

  const cur = items[idx % items.length] ?? items[0]

  // 메시지 변경(및 홈 진입) 시 앱 언어로 발화 — 같은 idx 재발화 방지.
  // 컨텍스트 질문 메시지는 낭독이 끝나면 AI 깐부가 주변 추천으로 이어서 답변한다.
  const nearbyRef = useRef(nearby)
  useEffect(() => {
    nearbyRef.current = nearby
  }, [nearby])
  useEffect(() => {
    // muted가 deps에 있어 소리를 다시 켜면 아직 안 읽은 현재 메시지를 바로 낭독한다(켜짐 피드백)
    if (!focused || muted || spokenRef.current === idx) return
    spokenRef.current = idx
    const answer = !cur.isGreeting && nearbyRef.current ? answerLine(lang, nearbyRef.current) : null
    speakMessage(cur.text, lang, () => {
      // 질문 낭독 종료 → 답변 낭독(홈에 머무는 동안 + 소리 켜짐 상태만)
      if (answer && spokenRef.current === idx && useGganbuLive.getState().active)
        speakMessage(answer, lang)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, focused, muted])

  // 홈을 벗어나면 발화 중단
  useEffect(() => {
    if (!focused) stopSpeak()
  }, [focused])

  return { ...cur, muted, toggleMute }
}
