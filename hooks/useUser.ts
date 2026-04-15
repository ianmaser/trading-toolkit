'use client'

import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

interface Profile {
  id: string
  display_name: string | null
  account_size: number
  language_mode: 'plain' | 'technical'
  created_at: string
}

interface UseUserReturn {
  user: User | null
  profile: Profile | null
  isLoading: boolean
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchProfile(userId: string) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      setProfile(data)
    }

    // Initial session load
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) fetchProfile(user.id).finally(() => setIsLoading(false))
      else setIsLoading(false)
    })

    // Keep in sync on auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null
        setUser(nextUser)
        if (nextUser) fetchProfile(nextUser.id)
        else setProfile(null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, profile, isLoading }
}
