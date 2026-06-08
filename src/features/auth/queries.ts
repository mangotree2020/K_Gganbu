import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { auth } from '@/lib/firebase'
import { useAuthStore } from './store'
import type { LoginFormData, RegisterFormData } from './types'

function toAuthUser(user: NonNullable<ReturnType<typeof auth>['currentUser']>) {
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
      const { user } = await auth().signInWithEmailAndPassword(email, password)
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
      const { user } = await auth().createUserWithEmailAndPassword(email, password)
      await user.updateProfile({ displayName: fullName })
      return user
    },
    onSuccess: (user) => {
      setUser(toAuthUser(user))
      router.replace('/(tabs)' as never)
    },
  })
}

export function useSignOut() {
  const signOut = useAuthStore((state) => state.signOut)

  return useMutation({
    mutationFn: () => auth().signOut(),
    onSuccess: () => {
      signOut()
      router.replace('/(auth)/login')
    },
  })
}
