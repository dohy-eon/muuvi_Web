import { atom } from 'recoil'
import type { User } from '@supabase/supabase-js'

export const userState = atom<User | null>({
  key: 'userState',
  default: null,
})

export const interestsState = atom<string[]>({
  key: 'interestsState',
  default: [],
})
