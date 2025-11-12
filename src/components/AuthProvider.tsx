import { useEffect, type ReactNode } from 'react'
import { useSetRecoilState } from 'recoil'
import { supabase } from '../lib/supabase'
import { userState } from '../recoil/userState'

interface AuthProviderProps {
  children: ReactNode
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const setUser = useSetRecoilState(userState)

  useEffect(() => {
    let isMounted = true

    const syncSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (isMounted) {
          setUser(data.session?.user ?? null)
        }
      } catch (error) {
        console.error('세션 조회 실패:', error)
      }
    }

    void syncSession()

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      isMounted = false
      authListener.subscription.unsubscribe()
    }
  }, [setUser])

  return <>{children}</>
}

