import axios from 'axios'
import { auth } from '@/lib/firebase'

export const api = axios.create({
  baseURL: process.env['EXPO_PUBLIC_API_URL'],
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Firebase ID Token을 Authorization 헤더에 자동 주입
api.interceptors.request.use(async (config) => {
  const user = auth().currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 응답 시 토큰 강제 갱신 후 재시도
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const user = auth().currentUser
      if (user) {
        const token = await user.getIdToken(true)
        error.config.headers.Authorization = `Bearer ${token}`
        return api(error.config)
      }
    }
    return Promise.reject(error)
  },
)
