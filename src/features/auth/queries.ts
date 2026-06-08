import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  type FirebaseAuthTypes,
} from '@react-native-firebase/auth'
import { firebaseAuth } from '@/lib/firebase'
import { useAuthStore } from './store'
import type { LoginFormData, RegisterFormData } from './types'

function toAuthUser(user: FirebaseAuthTypes.User) {
  return {
    id: user.uid,
    email: user.email!,
    fullName: user.displayName ?? null,
    avatarUrl: user.photoURL ?? null,
    createdAt: user.metadata.creationTime ?? new Date().toISOString(),
  }
}

export function useSignIn() {
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: async ({ email, password }: LoginFormData) => {
      const { user } = await signInWithEmailAndPassword(firebaseAuth, email, password)
      return user
    },
    onSuccess: (user) => {
      setUser(toAuthUser(user))
      router.replace('/(tabs)' as never)
    },
  })
}

export function useSignUp() {
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: async ({ email, password, fullName }: RegisterFormData) => {
      const { user } = await createUserWithEmailAndPassword(firebaseAuth, email, password)
      await updateProfile(user, { displayName: fullName })
      return user
    },
    onSuccess: (user) => {
      setUser(toAuthUser(user))
      router.replace('/(tabs)' as never)
    },
  })
}

export function useSignOut() {
  const clearAuth = useAuthStore((state) => state.signOut)

  return useMutation({
    mutationFn: () => firebaseSignOut(firebaseAuth),
    onSuccess: () => {
      clearAuth()
      router.replace('/(auth)/login')
    },
  })
}
