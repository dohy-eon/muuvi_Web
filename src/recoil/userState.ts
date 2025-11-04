import { atom } from 'recoil'
import type { User } from '@supabase/supabase-js'
import type { OnboardingData } from '../types'

export const userState = atom<User | null>({
  key: 'userState',
  default: null,
})

export const interestsState = atom<string[]>({
  key: 'interestsState',
  default: [],
})

export const onboardingDataState = atom<OnboardingData | null>({
  key: 'onboardingDataState',
  default: null,
})
