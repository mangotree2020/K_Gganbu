// 상황별 회화 — 오프라인 번들 (PLANNING §6, §12). 5개 언어 + 한국어 "보여주기"
// 각 문구: ko(상대에게 보여줄 한국어) + 사용자 언어 번역(en/ja/zh-CN/zh-TW)

export type Lang = 'en' | 'ja' | 'zh-CN' | 'zh-TW'
export type Phrase = {
  ko: string
  en: string
  ja: string
  'zh-CN': string
  'zh-TW': string
}
export type Scenario = {
  id: string
  title: string
  icon: string
  color: string
  bg: string
  phrases: Phrase[]
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'restaurant',
    title: 'Restaurant',
    icon: 'restaurant',
    color: '#0EA5E9',
    bg: '#F0F9FF',
    phrases: [
      {
        ko: '메뉴판 주세요.',
        en: 'Menu, please.',
        ja: 'メニューをください。',
        'zh-CN': '请给我菜单。',
        'zh-TW': '請給我菜單。',
      },
      {
        ko: '이 음식에 돼지고기가 들어가나요?',
        en: 'Does this dish contain pork?',
        ja: 'この料理に豚肉は入っていますか？',
        'zh-CN': '这道菜含有猪肉吗？',
        'zh-TW': '這道菜含有豬肉嗎？',
      },
      {
        ko: '덜 맵게 해주세요.',
        en: 'Please make it less spicy.',
        ja: '辛さを控えめにしてください。',
        'zh-CN': '请做得不要太辣。',
        'zh-TW': '請做得不要太辣。',
      },
      {
        ko: '계산서 주세요.',
        en: 'The bill, please.',
        ja: 'お会計をお願いします。',
        'zh-CN': '请结账。',
        'zh-TW': '請結帳。',
      },
      {
        ko: '카드로 결제할게요.',
        en: "I'll pay by card.",
        ja: 'カードで払います。',
        'zh-CN': '我用信用卡付款。',
        'zh-TW': '我用信用卡付款。',
      },
    ],
  },
  {
    id: 'taxi',
    title: 'Taxi',
    icon: 'local_taxi',
    color: '#F97316',
    bg: '#FFF7ED',
    phrases: [
      {
        ko: '이 주소로 가주세요.',
        en: 'Please go to this address.',
        ja: 'この住所までお願いします。',
        'zh-CN': '请到这个地址。',
        'zh-TW': '請到這個地址。',
      },
      {
        ko: '얼마나 걸리나요?',
        en: 'How long will it take?',
        ja: 'どのくらいかかりますか？',
        'zh-CN': '需要多长时间？',
        'zh-TW': '需要多久？',
      },
      {
        ko: '여기서 세워주세요.',
        en: 'Please stop here.',
        ja: 'ここで止めてください。',
        'zh-CN': '请在这里停车。',
        'zh-TW': '請在這裡停車。',
      },
      {
        ko: '영수증 주세요.',
        en: 'Receipt, please.',
        ja: '領収書をください。',
        'zh-CN': '请给我收据。',
        'zh-TW': '請給我收據。',
      },
    ],
  },
  {
    id: 'hospital',
    title: 'Hospital',
    icon: 'medical_services',
    color: '#EC4899',
    bg: '#FCE7F3',
    phrases: [
      {
        ko: '몸이 아파요.',
        en: "I'm not feeling well.",
        ja: '体調が悪いです。',
        'zh-CN': '我身体不舒服。',
        'zh-TW': '我身體不舒服。',
      },
      {
        ko: '여기가 아파요.',
        en: 'It hurts here.',
        ja: 'ここが痛いです。',
        'zh-CN': '这里疼。',
        'zh-TW': '這裡痛。',
      },
      {
        ko: '저는 땅콩 알레르기가 있어요.',
        en: 'I am allergic to peanuts.',
        ja: '私はピーナッツアレルギーがあります。',
        'zh-CN': '我对花生过敏。',
        'zh-TW': '我對花生過敏。',
      },
      {
        ko: '약을 사고 싶어요.',
        en: 'I want to buy medicine.',
        ja: '薬を買いたいです。',
        'zh-CN': '我想买药。',
        'zh-TW': '我想買藥。',
      },
    ],
  },
  {
    id: 'shopping',
    title: 'Shopping',
    icon: 'shopping_bag',
    color: '#0D9488',
    bg: '#F0FDFA',
    phrases: [
      {
        ko: '이거 얼마예요?',
        en: 'How much is this?',
        ja: 'これはいくらですか？',
        'zh-CN': '这个多少钱？',
        'zh-TW': '這個多少錢？',
      },
      {
        ko: '입어봐도 될까요?',
        en: 'Can I try this on?',
        ja: '試着してもいいですか？',
        'zh-CN': '我可以试穿吗？',
        'zh-TW': '我可以試穿嗎？',
      },
      {
        ko: '택스 리펀드 되나요?',
        en: 'Do you offer tax refund?',
        ja: '免税はできますか？',
        'zh-CN': '可以退税吗？',
        'zh-TW': '可以退稅嗎？',
      },
      {
        ko: '깎아주세요.',
        en: 'Can you give me a discount?',
        ja: '安くしてください。',
        'zh-CN': '可以便宜一点吗？',
        'zh-TW': '可以便宜一點嗎？',
      },
    ],
  },
  {
    id: 'emergency',
    title: 'Emergency',
    icon: 'emergency',
    color: '#DC2626',
    bg: '#FEE2E2',
    phrases: [
      {
        ko: '도와주세요!',
        en: 'Please help me!',
        ja: '助けてください！',
        'zh-CN': '请帮帮我！',
        'zh-TW': '請幫幫我！',
      },
      {
        ko: '경찰을 불러주세요.',
        en: 'Please call the police.',
        ja: '警察を呼んでください。',
        'zh-CN': '请叫警察。',
        'zh-TW': '請叫警察。',
      },
      {
        ko: '구급차를 불러주세요.',
        en: 'Please call an ambulance.',
        ja: '救急車を呼んでください。',
        'zh-CN': '请叫救护车。',
        'zh-TW': '請叫救護車。',
      },
      {
        ko: '지갑을 잃어버렸어요.',
        en: 'I lost my wallet.',
        ja: '財布をなくしました。',
        'zh-CN': '我的钱包丢了。',
        'zh-TW': '我的錢包不見了。',
      },
    ],
  },
  {
    id: 'hotel',
    title: 'Hotel',
    icon: 'hotel',
    color: '#F59E0B',
    bg: '#FEF3C7',
    phrases: [
      {
        ko: '체크인하고 싶어요.',
        en: "I'd like to check in.",
        ja: 'チェックインをお願いします。',
        'zh-CN': '我想办理入住。',
        'zh-TW': '我想辦理入住。',
      },
      {
        ko: '와이파이 비밀번호가 뭐예요?',
        en: 'What is the Wi-Fi password?',
        ja: 'Wi-Fiのパスワードは何ですか？',
        'zh-CN': 'Wi-Fi密码是多少？',
        'zh-TW': 'Wi-Fi密碼是多少？',
      },
      {
        ko: '짐을 맡길 수 있을까요?',
        en: 'Can I leave my luggage here?',
        ja: '荷物を預けられますか？',
        'zh-CN': '可以寄存行李吗？',
        'zh-TW': '可以寄放行李嗎？',
      },
      {
        ko: '체크아웃 시간이 언제예요?',
        en: 'What time is check-out?',
        ja: 'チェックアウトは何時ですか？',
        'zh-CN': '退房时间是几点？',
        'zh-TW': '退房時間是幾點？',
      },
    ],
  },
]

export function findScenario(id?: string) {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]
}
