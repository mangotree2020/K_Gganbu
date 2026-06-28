// 12지신(한국 전통 띠) — 태어난 해 → 동물, 성별별 캐릭터 이미지 매핑.
// 이미지는 assets/zodiac/{female,male}/{animal}.jpg (768px JPEG, 용량 최적화본).
import type { ImageSourcePropType } from 'react-native'
import type { AppLang } from '@/lib/i18n'

export type Gender = 'female' | 'male'

// 띠 순서: 자(쥐)부터. index = (year - 4) % 12
export const ZODIAC_ANIMALS = [
  'mouse', // 자(子) 쥐
  'cow', // 축(丑) 소
  'tiger', // 인(寅) 호랑이
  'rabbit', // 묘(卯) 토끼
  'dragon', // 진(辰) 용
  'snake', // 사(巳) 뱀
  'horse', // 오(午) 말
  'sheep', // 미(未) 양
  'monkey', // 신(申) 원숭이
  'chicken', // 유(酉) 닭
  'dog', // 술(戌) 개
  'pig', // 해(亥) 돼지
] as const

export type ZodiacAnimal = (typeof ZODIAC_ANIMALS)[number]

// 띠별 이모지 (라벨·폴백용)
export const ZODIAC_EMOJI: Record<ZodiacAnimal, string> = {
  mouse: '🐭',
  cow: '🐮',
  tiger: '🐯',
  rabbit: '🐰',
  dragon: '🐲',
  snake: '🐍',
  horse: '🐴',
  sheep: '🐑',
  monkey: '🐵',
  chicken: '🐔',
  dog: '🐶',
  pig: '🐷',
}

// 띠별 영문 라벨 (Year of the ~)
export const ZODIAC_LABEL: Record<ZodiacAnimal, string> = {
  mouse: 'Rat',
  cow: 'Ox',
  tiger: 'Tiger',
  rabbit: 'Rabbit',
  dragon: 'Dragon',
  snake: 'Snake',
  horse: 'Horse',
  sheep: 'Goat',
  monkey: 'Monkey',
  chicken: 'Rooster',
  dog: 'Dog',
  pig: 'Pig',
}

// 언어별 띠 동물 이름 (ko/ja/zh는 干支 한자·고유어)
const ZODIAC_LABEL_I18N: Record<AppLang, Record<ZodiacAnimal, string>> = {
  en: ZODIAC_LABEL,
  ko: {
    mouse: '쥐',
    cow: '소',
    tiger: '호랑이',
    rabbit: '토끼',
    dragon: '용',
    snake: '뱀',
    horse: '말',
    sheep: '양',
    monkey: '원숭이',
    chicken: '닭',
    dog: '개',
    pig: '돼지',
  },
  ja: {
    mouse: 'ねずみ',
    cow: 'うし',
    tiger: 'とら',
    rabbit: 'うさぎ',
    dragon: 'たつ',
    snake: 'へび',
    horse: 'うま',
    sheep: 'ひつじ',
    monkey: 'さる',
    chicken: 'とり',
    dog: 'いぬ',
    pig: 'いのしし',
  },
  'zh-CN': {
    mouse: '鼠',
    cow: '牛',
    tiger: '虎',
    rabbit: '兔',
    dragon: '龙',
    snake: '蛇',
    horse: '马',
    sheep: '羊',
    monkey: '猴',
    chicken: '鸡',
    dog: '狗',
    pig: '猪',
  },
  'zh-TW': {
    mouse: '鼠',
    cow: '牛',
    tiger: '虎',
    rabbit: '兔',
    dragon: '龍',
    snake: '蛇',
    horse: '馬',
    sheep: '羊',
    monkey: '猴',
    chicken: '雞',
    dog: '狗',
    pig: '豬',
  },
}

// 언어별 "Year of the X" 표현 — 로케일 어순에 맞게 조합
export function zodiacYearLabel(lang: AppLang, animal: ZodiacAnimal): string {
  const name = ZODIAC_LABEL_I18N[lang]?.[animal] ?? ZODIAC_LABEL[animal]
  switch (lang) {
    case 'ko':
      return `${name}띠`
    case 'ja':
    case 'zh-CN':
    case 'zh-TW':
      return `${name}年`
    default:
      return `Year of the ${name}`
  }
}

// 언어별 띠 동물 이름만 (배지용)
export function zodiacName(lang: AppLang, animal: ZodiacAnimal): string {
  return ZODIAC_LABEL_I18N[lang]?.[animal] ?? ZODIAC_LABEL[animal]
}

// 태어난 해 → 띠 동물
export function zodiacOf(year: number): ZodiacAnimal {
  const idx = (((year - 4) % 12) + 12) % 12
  return ZODIAC_ANIMALS[idx]
}

// 성별·동물 → 캐릭터 이미지. require는 정적이어야 하므로 전수 매핑.
const IMAGES: Record<Gender, Record<ZodiacAnimal, ImageSourcePropType>> = {
  female: {
    mouse: require('../../../assets/zodiac/female/mouse.jpg'),
    cow: require('../../../assets/zodiac/female/cow.jpg'),
    tiger: require('../../../assets/zodiac/female/tiger.jpg'),
    rabbit: require('../../../assets/zodiac/female/rabbit.jpg'),
    dragon: require('../../../assets/zodiac/female/dragon.jpg'),
    snake: require('../../../assets/zodiac/female/snake.jpg'),
    horse: require('../../../assets/zodiac/female/horse.jpg'),
    sheep: require('../../../assets/zodiac/female/sheep.jpg'),
    monkey: require('../../../assets/zodiac/female/monkey.jpg'),
    chicken: require('../../../assets/zodiac/female/chicken.jpg'),
    dog: require('../../../assets/zodiac/female/dog.jpg'),
    pig: require('../../../assets/zodiac/female/pig.jpg'),
  },
  male: {
    mouse: require('../../../assets/zodiac/male/mouse.jpg'),
    cow: require('../../../assets/zodiac/male/cow.jpg'),
    tiger: require('../../../assets/zodiac/male/tiger.jpg'),
    rabbit: require('../../../assets/zodiac/male/rabbit.jpg'),
    dragon: require('../../../assets/zodiac/male/dragon.jpg'),
    snake: require('../../../assets/zodiac/male/snake.jpg'),
    horse: require('../../../assets/zodiac/male/horse.jpg'),
    sheep: require('../../../assets/zodiac/male/sheep.jpg'),
    monkey: require('../../../assets/zodiac/male/monkey.jpg'),
    chicken: require('../../../assets/zodiac/male/chicken.jpg'),
    dog: require('../../../assets/zodiac/male/dog.jpg'),
    pig: require('../../../assets/zodiac/male/pig.jpg'),
  },
}

// 성별·태어난 해 → 캐릭터 이미지 소스
export function zodiacImage(gender: Gender, year: number): ImageSourcePropType {
  return IMAGES[gender][zodiacOf(year)]
}

// 성별·동물 직접 지정 버전
export function zodiacImageByAnimal(gender: Gender, animal: ZodiacAnimal): ImageSourcePropType {
  return IMAGES[gender][animal]
}
