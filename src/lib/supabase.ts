import { createClient } from '@supabase/supabase-js'
import { storage } from '@/lib/mmkv'

const supabaseUrl = process.env['EXPO_PUBLIC_SUPABASE_URL']!
const supabaseAnonKey = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY']!

const mmkvStorageAdapter = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => { storage.remove(key) },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: mmkvStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
