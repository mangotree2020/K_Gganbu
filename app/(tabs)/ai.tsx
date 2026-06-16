import { LinearGradient } from 'expo-linear-gradient'
import { useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Icon } from '@/components/brand'
import { palette } from '@/theme/tokens'

type Schedule = { time: string; place: string; icon: string }
type ListItem = { name: string; note: string }
type Msg = {
  role: 'bot' | 'user'
  text: string
  quick?: string[]
  schedule?: Schedule[]
  list?: ListItem[]
}

const REPLIES: Record<string, Omit<Msg, 'role'>> = {
  'Make my day plan': {
    text: "You're in Haeundae, late morning. Try this half-day:",
    schedule: [
      { time: '11:00', place: 'Mipojeong (gukbap brunch)', icon: 'ramen_dining' },
      { time: '12:30', place: 'Blueline Sky Capsule', icon: 'tour' },
      { time: '14:00', place: 'Bada View Cafe', icon: 'local_cafe' },
      { time: '15:30', place: 'Gwangan Bridge stroll', icon: 'directions_walk' },
    ],
    quick: ['Add all to schedule', 'Find seafood instead', 'Make it cheaper'],
  },
  'Find foreigner-friendly food': {
    text: 'These spots have English menus AND foreigner reviews ≥4.5 ★:',
    list: [
      { name: 'Halmae Gukbap', note: 'EN menu · halal-option' },
      { name: 'Slow Calm', note: 'Vegetarian · QR menu in 5 lang' },
      { name: 'Ediya 24h', note: 'Cafe · accepts foreign cards' },
    ],
    quick: ['Show on map', 'Filter: halal', 'Filter: vegan'],
  },
  'Help me read a menu': {
    text: "Tap the camera button — I'll OCR & translate live, and flag allergens and spicy items.",
    quick: ['Open camera now', 'Set my allergies', 'How to ask for less spicy'],
  },
  "🆘 I'm stuck": {
    text: 'Tell me what is happening. I can call 1330 (tourist hotline, free, EN), translate for officials, or find your nearest embassy/hospital.',
    quick: ['Call 1330', 'Lost wallet', 'Got sick', 'Lost ride'],
  },
}

const INITIAL: Msg = {
  role: 'bot',
  text: "안녕! I'm Mate — your local Busan guide. I plan, translate, and rescue. Where shall we begin?",
  quick: [
    'Make my day plan',
    'Find foreigner-friendly food',
    'Help me read a menu',
    "🆘 I'm stuck",
  ],
}

export default function AiMateScreen() {
  const [msgs, setMsgs] = useState<Msg[]>([INITIAL])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  const scrollEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)

  const send = (text: string) => {
    if (!text.trim()) return
    setMsgs((m) => [...m, { role: 'user', text }])
    setInput('')
    setTyping(true)
    scrollEnd()
    setTimeout(() => {
      setTyping(false)
      const r = REPLIES[text] ?? {
        text: "Got it — I'll keep that in context. Want me to find places, plan time, or translate?",
        quick: ['Find places', 'Plan time', 'Translate'],
      }
      setMsgs((m) => [...m, { role: 'bot', ...r }])
      scrollEnd()
    }, 850)
  }

  return (
    <View style={ss.container}>
      {/* 헤더 */}
      <View style={ss.header}>
        <SafeAreaView edges={['top']}>
          <View style={ss.headerRow}>
            <LinearGradient
              colors={['#38BDF8', '#0EA5E9', '#0D9488']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={ss.avatar}>
              <Icon name="auto_awesome" size={22} color="#fff" filled />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={ss.headerTitle}>AI Gganbu</Text>
              <View style={ss.statusRow}>
                <Icon name="circle" size={6} color={palette.success[50]} filled />
                <Text style={ss.statusText}>Online · Claude Sonnet 4</Text>
              </View>
            </View>
            <View style={ss.historyBtn}>
              <Icon name="history" size={18} color={palette.zinc[900]} />
            </View>
          </View>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, gap: 10 }}
          showsVerticalScrollIndicator={false}>
          {msgs.map((m, i) =>
            m.role === 'user' ? (
              <View key={i} style={ss.userBubble}>
                <Text style={ss.userText}>{m.text}</Text>
              </View>
            ) : (
              <View key={i} style={ss.botCol}>
                <View style={ss.botBubble}>
                  <Text style={ss.botText}>{m.text}</Text>
                </View>
                {m.schedule && (
                  <View style={ss.attachCard}>
                    {m.schedule.map((s, j) => (
                      <View key={j} style={ss.schedRow}>
                        <View style={ss.schedIcon}>
                          <Icon name={s.icon} size={16} color={palette.blue[30]} filled />
                        </View>
                        <Text style={ss.schedTime}>{s.time}</Text>
                        <Text style={ss.schedPlace}>{s.place}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {m.list && (
                  <View style={ss.attachCard}>
                    {m.list.map((it) => (
                      <View key={it.name} style={ss.listRow}>
                        <Text style={ss.listName}>{it.name}</Text>
                        <Text style={ss.listNote}>{it.note}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {m.quick && (
                  <View style={ss.quickWrap}>
                    {m.quick.map((q) => (
                      <Pressable key={q} onPress={() => send(q)} style={ss.quickChip}>
                        <Text style={ss.quickText}>{q}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ),
          )}
          {typing && (
            <View style={[ss.botBubble, ss.typingBubble]}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={ss.typingDot} />
              ))}
            </View>
          )}
        </ScrollView>

        {/* 입력 바 */}
        <View style={ss.inputBar}>
          <Pressable style={ss.micBtn}>
            <Icon name="mic" size={18} color={palette.zinc[900]} />
          </Pressable>
          <View style={ss.inputWrap}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send(input)}
              placeholder="Ask anything about Korea travel…"
              placeholderTextColor={palette.zinc[400]}
              style={ss.input}
              returnKeyType="send"
            />
          </View>
          <Pressable
            onPress={() => send(input)}
            style={[
              ss.sendBtn,
              { backgroundColor: input.trim() ? palette.blue[50] : palette.zinc[200] },
            ]}>
            <Icon name="arrow_upward" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.zinc[50] },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: palette.zinc[200],
    paddingHorizontal: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: palette.zinc[900], letterSpacing: -0.2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusText: { fontSize: 11, color: palette.zinc[500] },
  historyBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },

  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: palette.blue[50],
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderBottomRightRadius: 6,
  },
  userText: { color: '#fff', fontSize: 13, lineHeight: 19 },
  botCol: { alignSelf: 'flex-start', maxWidth: '94%', gap: 6 },
  botBubble: {
    backgroundColor: '#fff',
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
  },
  botText: { color: palette.zinc[900], fontSize: 13, lineHeight: 19 },
  attachCard: {
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: palette.zinc[200],
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  schedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  schedIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: palette.blue[90],
    alignItems: 'center',
    justifyContent: 'center',
  },
  schedTime: { width: 44, fontSize: 11, fontWeight: '700', color: palette.blue[30] },
  schedPlace: { flex: 1, fontSize: 12, color: palette.zinc[900], fontWeight: '500' },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  listName: { fontSize: 12.5, fontWeight: '700', color: palette.zinc[900] },
  listNote: { fontSize: 10, color: palette.zinc[500] },
  quickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickChip: {
    borderWidth: 0.5,
    borderColor: palette.blue[80],
    backgroundColor: palette.blue[95],
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  quickText: { color: palette.blue[30], fontSize: 11.5, fontWeight: '600' },
  typingBubble: { flexDirection: 'row', gap: 4, alignSelf: 'flex-start' },
  typingDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: palette.zinc[400] },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 0.5,
    borderTopColor: palette.zinc[200],
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    backgroundColor: palette.zinc[100],
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  input: { fontSize: 13, color: palette.zinc[900], padding: 0 },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
