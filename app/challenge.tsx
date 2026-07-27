// 한국어 데일리 챌린지 (REQ-KL-1~5) — 오늘의 여행 문장 5문제.
// 문제는 상황별 회화 데이터 재사용, 발음은 기존 TTS(speakMessage)로 듣는다.
// 완료 보상(20P)은 서버가 하루 1회 멱등으로 지급 — 로컬 진도는 표시·동기부여용.
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { SheetHeader } from '@/components/SheetHeader'
import { useLoginPrompt } from '@/features/auth/loginPrompt'
import { useAuthStore } from '@/features/auth/store'
import { dailyQuiz, todayKey } from '@/features/challenge/daily'
import { useEarnChallenge } from '@/features/challenge/queries'
import { levelOf, levelProgress, useChallengeStore } from '@/features/challenge/store'
import { useLocaleStore, useT } from '@/lib/i18n'
import { speakMessage } from '@/lib/speak'
import { palette, shadows } from '@/theme/tokens'

export default function ChallengeScreen() {
  const t = useT()
  const lang = useLocaleStore((s) => s.lang)
  const user = useAuthStore((s) => s.user)
  const showLogin = useLoginPrompt((s) => s.show)
  const isGuest = !user || user.isGuest

  const quiz = useMemo(() => dailyQuiz(lang), [lang])
  const { lastDone, streak, totalDays, complete } = useChallengeStore()
  const doneToday = lastDone === todayKey()
  const earn = useEarnChallenge()

  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [correct, setCorrect] = useState(0)
  const [finished, setFinished] = useState(false)
  const [reward, setReward] = useState<number | null>(null)

  const q = quiz[idx]

  const onPick = (choice: string) => {
    if (picked) return
    setPicked(choice)
    if (choice === q.answer) setCorrect((c) => c + 1)
  }

  const onNext = async () => {
    if (idx + 1 < quiz.length) {
      setIdx(idx + 1)
      setPicked(null)
      return
    }
    setFinished(true)
    complete(correct)
    // 보상 — 게스트는 적립 불가(로그인 유도). 서버가 하루 1회만 지급.
    if (isGuest) return
    try {
      const res = await earn.mutateAsync()
      setReward(res.granted ?? 0)
    } catch {
      setReward(null)
    }
  }

  const restart = () => {
    setIdx(0)
    setPicked(null)
    setCorrect(0)
    setFinished(false)
    setReward(null)
  }

  return (
    <View style={ss.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <SheetHeader
          title={t('challenge.title')}
          sub={t('challenge.sub')}
          icon="lightbulb"
          accent={palette.teal[40]}
          accentBg={palette.teal[95]}
        />

        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
          {/* 진도 — 연속 출석·레벨 (REQ-KL-2) */}
          <View style={[ss.progressCard, shadows.card]}>
            <View style={{ flex: 1 }}>
              <Text style={ss.progressLabel}>
                {t('challenge.level').replace('{n}', String(levelOf(totalDays)))}
              </Text>
              <View style={ss.track}>
                <View
                  style={[ss.fill, { width: `${Math.round(levelProgress(totalDays) * 100)}%` }]}
                />
              </View>
            </View>
            <View style={ss.streakBox}>
              <Text style={{ fontSize: 18 }}>🔥</Text>
              <Text style={ss.streakNum}>{streak}</Text>
              <Text style={ss.streakLabel}>{t('challenge.streak')}</Text>
            </View>
          </View>

          {finished ? (
            <View style={[ss.card, shadows.card]}>
              <Text style={{ fontSize: 40, textAlign: 'center' }}>
                {correct === quiz.length ? '🎉' : '👏'}
              </Text>
              <Text style={ss.resultTitle}>
                {t('challenge.result')
                  .replace('{n}', String(correct))
                  .replace('{total}', String(quiz.length))}
              </Text>
              {isGuest ? (
                <Pressable onPress={() => showLogin('auth.gatePoints')} style={ss.primaryBtn}>
                  <Text style={ss.primaryText}>{t('points.guestCta')}</Text>
                </Pressable>
              ) : reward != null && reward > 0 ? (
                <Text style={ss.reward}>{t('points.claimed').replace('{n}', String(reward))}</Text>
              ) : (
                // 오늘 이미 받았거나 상한 도달 — 학습 자체는 계속할 수 있음을 알린다
                <Text style={ss.rewardDim}>{t('challenge.rewardDone')}</Text>
              )}
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                <Pressable onPress={restart} style={ss.secondaryBtn}>
                  <Text style={ss.secondaryText}>{t('challenge.again')}</Text>
                </Pressable>
                <Pressable onPress={() => router.back()} style={ss.secondaryBtn}>
                  <Text style={ss.secondaryText}>{t('game.exit')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={[ss.card, shadows.card]}>
              <Text style={ss.counter}>
                {idx + 1} / {quiz.length} · {q.scenario}
              </Text>
              {/* 문제 = 한국어 문장. 스피커로 발음 듣기(REQ-KL-3 1차 — 기존 TTS 재사용) */}
              <View style={ss.koRow}>
                <Text style={ss.koText}>{q.ko}</Text>
                <Pressable
                  onPress={() => speakMessage(q.ko, 'ko', { rate: 0.9 })}
                  hitSlop={8}
                  style={ss.speakBtn}>
                  <Icon name="volume_up" size={18} color={palette.teal[40]} />
                </Pressable>
              </View>
              <Text style={ss.question}>{t('challenge.question')}</Text>
              {q.choices.map((c) => {
                const isAnswer = c === q.answer
                const state = !picked
                  ? 'idle'
                  : isAnswer
                    ? 'correct'
                    : c === picked
                      ? 'wrong'
                      : 'dim'
                return (
                  <Pressable
                    key={c}
                    onPress={() => onPick(c)}
                    style={[
                      ss.choice,
                      state === 'correct' && ss.choiceCorrect,
                      state === 'wrong' && ss.choiceWrong,
                      state === 'dim' && { opacity: 0.5 },
                    ]}>
                    <Text style={ss.choiceText}>{c}</Text>
                    {state === 'correct' && (
                      <Icon name="check_circle" size={16} color={palette.success[50]} filled />
                    )}
                  </Pressable>
                )
              })}
              {!!picked && (
                <Pressable onPress={onNext} style={ss.primaryBtn}>
                  <Text style={ss.primaryText}>
                    {idx + 1 < quiz.length ? t('challenge.next') : t('challenge.finish')}
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {doneToday && !finished && <Text style={ss.note}>{t('challenge.doneToday')}</Text>}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
  },
  progressLabel: { fontSize: 13, fontWeight: '800', color: palette.zinc[900], marginBottom: 6 },
  track: { height: 6, borderRadius: 3, backgroundColor: palette.zinc[200] },
  fill: { height: 6, borderRadius: 3, backgroundColor: palette.teal[40] },
  streakBox: { alignItems: 'center' },
  streakNum: { fontSize: 16, fontWeight: '800', color: palette.zinc[900] },
  streakLabel: { fontSize: 9, color: palette.zinc[500] },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 10 },
  counter: { fontSize: 11, fontWeight: '700', color: palette.zinc[500] },
  koRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  koText: { flex: 1, fontSize: 20, fontWeight: '800', color: palette.zinc[900], lineHeight: 28 },
  speakBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.teal[95],
  },
  question: { fontSize: 12, color: palette.zinc[500], marginBottom: 2 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: palette.zinc[200],
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  choiceCorrect: { borderColor: palette.success[50], backgroundColor: palette.success[90] },
  choiceWrong: { borderColor: palette.error[50], backgroundColor: '#FEF2F2' },
  choiceText: { flex: 1, fontSize: 14, color: palette.zinc[800] },
  primaryBtn: {
    backgroundColor: palette.teal[40],
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  secondaryBtn: {
    backgroundColor: palette.zinc[200],
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  secondaryText: { color: palette.zinc[700], fontWeight: '800', fontSize: 13 },
  resultTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.zinc[900],
    textAlign: 'center',
  },
  reward: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.amber[50],
    textAlign: 'center',
  },
  rewardDim: { fontSize: 12, color: palette.zinc[500], textAlign: 'center' },
  note: { fontSize: 11, color: palette.zinc[500], textAlign: 'center' },
})
