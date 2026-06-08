import { useEffect } from 'react'
import { onAuthStateChanged } from '@react-native-firebase/auth'
import { firebaseAuth } from '@/lib/firebase'
import { useAuthStore } from '@/features/auth/store'

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email!,
          fullName: firebaseUser.displayName ?? null,
          avatarUrl: firebaseUser.photoURL ?? null,
          createdAt: firebaseUser.metadata.creationTime ?? new Date().toISOString(),
        })
      } else {
        setUser(null)
      }
    })

    return unsubscribe
  }, [setUser, setLoading])

  return { user, isAuthenticated, isLoading }
}
