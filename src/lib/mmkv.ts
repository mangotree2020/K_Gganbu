import { createMMKV } from 'react-native-mmkv'

// MMKV v4 API: new MMKV() → createMMKV()
export const storage = createMMKV({ id: 'travel-app-storage' })

// Zustand persist 미들웨어용 어댑터
export const zustandStorage = {
  getItem: (name: string): string | null => storage.getString(name) ?? null,
  setItem: (name: string, value: string): void => storage.set(name, value),
  removeItem: (name: string): void => { storage.remove(name) },
}
